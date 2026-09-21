# 04 — Architecture

## Principles

1. **Feature-based folders.** Each feature owns its routes, pages, components, and store.
2. **One-way data flow.** API service → store (signals) → components (read signals, call store methods).
3. **Backend-agnostic.** Components never know the data is mocked. Only `core/mock-api/` knows.
4. **Contract-first.** Endpoints and payloads follow Laravel API Resource conventions so the future Laravel 12 API is a drop-in.

## Folder structure

```
src/
├── app/
│   ├── app.config.ts            # providers: router, http + interceptors, animations, locale
│   ├── app.routes.ts            # top-level routes, lazy loads features
│   ├── app.component.ts
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.store.ts          # current user + role (DEMO ONLY)
│   │   │   └── role.guard.ts          # CanMatchFn/CanActivateFn per role
│   │   ├── http/
│   │   │   ├── api.service.ts         # thin typed wrapper over HttpClient
│   │   │   ├── api-error.ts           # ApiError type + mapper
│   │   │   ├── base-url.interceptor.ts
│   │   │   └── error.interceptor.ts
│   │   ├── mock-api/
│   │   │   ├── mock-api.interceptor.ts   # routes requests to handlers
│   │   │   ├── mock-db.ts                # in-memory tables (signals not needed)
│   │   │   ├── handlers/                 # fairs.handler.ts, employers.handler.ts, ...
│   │   │   └── seed/                     # seed-*.ts generated with a fixed random seed
│   │   ├── models/                       # fair.model.ts, employer.model.ts, ...
│   │   ├── layout/                       # shell, top-bar, side-nav, role-switcher
│   │   └── error-handler.ts              # global ErrorHandler
│   ├── shared/
│   │   ├── ui/                  # empty-state, error-state, skeleton, status-chip, page-header, kpi-card
│   │   ├── pipes/               # mask-email.pipe.ts, myr.pipe.ts (if CurrencyPipe is not enough)
│   │   └── utils/
│   └── features/
│       ├── dashboard/
│       ├── fairs/
│       ├── floor-plan/
│       ├── employers/
│       ├── talent-pool/
│       ├── shortlist/
│       └── interviews/
│           ├── interviews.routes.ts
│           ├── interviews.store.ts
│           ├── pages/           # routed components
│           └── components/      # presentational components (inputs/outputs only)
├── environments/
│   ├── environment.model.ts     # the Environment interface (never file-replaced)
│   ├── environment.ts           # { production: true, apiBaseUrl: '/api', useMockApi: true }
│   └── environment.development.ts  # production: false; swapped in by fileReplacements
└── styles/                      # _tokens.scss, _theme-colors.scss
```

**Page vs component:** Pages inject stores and handle routing. Presentational components receive data through `input()` and emit via `output()`. They never inject stores or services.

## Routing

```ts
// src/app/app.routes.ts (shape, not final code)
export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [roleHomeRedirectGuard], children: [] },
  {
    path: 'staff',
    component: ShellComponent,
    canMatch: [roleGuard('staff')],
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes') },
      { path: 'fairs', loadChildren: () => import('./features/fairs/fairs.routes') },
      { path: 'employers', loadChildren: () => import('./features/employers/employers.routes') },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  {
    path: 'hiring',
    component: ShellComponent,
    canMatch: [roleGuard('hiring_manager')],
    children: [
      { path: 'talent-pool', loadChildren: () => import('./features/talent-pool/talent-pool.routes') },
      { path: 'shortlist', loadChildren: () => import('./features/shortlist/shortlist.routes') },
      { path: 'interviews', loadChildren: () => import('./features/interviews/interviews.routes') },
      { path: '', redirectTo: 'talent-pool', pathMatch: 'full' },
    ],
  },
  { path: '**', loadComponent: () => import('./core/layout/not-found.component') },
];
```

- Enable `withComponentInputBinding()` so route params bind to `input()`s.
- Enable `withViewTransitions()` only if it does not break reduced-motion handling.
- Talent pool filters live in query params; the page reads them and calls the store.
- **Active fair.** `Shortlist` and `InterviewSlot` are both scoped to a fair, but the talent-pool
  filters are not. The shell owns an **active-fair picker** (top bar, hiring-manager role only),
  defaulting to that hiring manager's next upcoming fair. `AuthStore` exposes it as a signal;
  talent pool, shortlist and interviews all read it. Built in Phase 1b, used from Phase 5a.

## State management

**Chosen:** Plain injectable signal stores (one per feature). No extra dependency, easy to explain.
**Alternative:** NgRx SignalStore — worth mentioning in the interview as the next step for larger apps.

### Store pattern (all stores follow this)

```ts
// src/app/features/fairs/fairs.store.ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { ApiError, toApiError } from '../../core/http/api-error';
import { Fair } from '../../core/models/fair.model';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class FairsStore {
  private readonly api = inject(ApiService);

  private readonly _fairs = signal<readonly Fair[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);

  readonly fairs = this._fairs.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._status() === 'success' && this._fairs().length === 0);

  async load(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);
    try {
      const res = await firstValueFrom(this.api.getList<Fair>('/fairs'));
      this._fairs.set(res.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }
}
```

Optimistic updates (drag-drop): snapshot previous state → update signal → call API → on error restore snapshot and show a snackbar with Retry.

## HTTP layer

Interceptor order in `app.config.ts`:

```ts
provideHttpClient(
  withFetch(),
  withInterceptors([
    baseUrlInterceptor,   // prefixes environment.apiBaseUrl
    errorInterceptor,     // maps errors to ApiError, snackbar for non-422
    ...(environment.useMockApi ? [mockApiInterceptor] : []), // last: short-circuits the request
  ]),
),
```

- `mockApiInterceptor` returns `of(new HttpResponse(...)).pipe(delay(300–800ms random))` and uses `throwError` with `HttpErrorResponse` for failures, so the error path is identical to a real server.
- A dev-only toggle (`?simulateErrors=1` query param, or a switch in the role menu) makes ~20% of requests fail. This is for demoing error states.

## API contract (mock now, Laravel later)

Base URL: `/api`. JSON. Snake_case on the wire; **convert to camelCase in `ApiService`** (one place) so models stay idiomatic TypeScript.

### Response envelopes (Laravel API Resources)

```jsonc
// Collection (paginated)
{ "data": [ ... ], "meta": { "current_page": 1, "per_page": 20, "total": 312, "last_page": 16 } }
// Single
{ "data": { ... } }
// Validation error (422)
{ "message": "The contact email field is required.", "errors": { "contact_email": ["The contact email field is required."] } }
// Other errors (404, 409, 500)
{ "message": "That slot was just booked." }
```

### Endpoints

| Method | Path | Query / body | Returns |
|---|---|---|---|
| GET | `/dashboard/summary` | — | `DashboardSummary` (see Data models) |
| GET | `/fairs` | `status`, `city` | Fair[] |
| GET | `/fairs/{id}` | — | Fair |
| GET | `/fairs/{id}/booths` | — | Booth[] |
| PATCH | `/booths/{id}` | `{ employer_id: string \| null }` | Booth (409 if already taken and not forced) |
| GET | `/employers` | `stage`, `fair_id`, `search` | Employer[] |
| GET | `/employers/{id}` | — | Employer |
| POST | `/employers` | EmployerInput | Employer (422 on validation) |
| PATCH | `/employers/{id}` | Partial EmployerInput, or `{ stage, lost_reason? }` | Employer |
| GET | `/candidates` | `search`, `university`, `field`, `grad_year`, `min_cgpa`, `sort`, `dir`, `page`, `per_page` | Paginated Candidate[] |
| GET | `/candidates/{id}` | — | Candidate (contact masked unless shortlisted) |
| GET | `/shortlists` | `fair_id` | Shortlist[] (with candidate) |
| POST | `/shortlists` | `{ candidate_id, fair_id, note? }` | Shortlist (409 if duplicate) |
| DELETE | `/shortlists/{id}` | — | 204 |
| GET | `/interview-slots` | `fair_id` | InterviewSlot[] |
| PATCH | `/interview-slots/{id}` | `{ candidate_id: string \| null }` | InterviewSlot (409 if taken) |
| POST | `/demo/reset` | — | 204 (mock only; reseeds DB) |

In the mock, the current employer for hiring-manager requests comes from `AuthStore`. In Laravel it will come from the authenticated user.

## Data models

```ts
// src/app/core/models/*.model.ts
export type Role = 'staff' | 'hiring_manager';
export type FairStatus = 'draft' | 'open' | 'live' | 'completed';
export type EmployerStage = 'lead' | 'proposal' | 'confirmed' | 'paid' | 'lost';
export type BoothPackage = 'standard' | 'premium' | 'platinum';
export type Qualification = 'diploma' | 'degree' | 'masters' | 'phd';

export interface User { id: string; name: string; role: Role; employerId: string | null; }

export interface Fair {
  id: string; name: string; venue: string; city: string;
  startDate: string; endDate: string;      // ISO 8601, +08:00
  status: FairStatus;
  boothTotal: number; boothAssigned: number;
  registrations: number; checkIns: number;
}

export interface Booth {
  id: string; fairId: string; code: string;  // e.g. "A-04"
  row: number; col: number;
  package: BoothPackage; priceMyr: number;
  employerId: string | null; employerName: string | null;
}

export interface Employer {
  id: string; name: string; industry: string;
  companySize: '1-50' | '51-200' | '201-1000' | '1000+';
  stage: EmployerStage; lostReason: string | null;
  contactName: string; contactEmail: string; contactPhone: string | null;
  boothPackage: BoothPackage | null; dealValueMyr: number | null;
  fairIds: readonly string[]; notes: string | null;
  createdAt: string; updatedAt: string;
}

export interface Candidate {
  id: string; fullName: string; university: string; fieldOfStudy: string;
  qualification: Qualification; graduationYear: number; cgpa: number | null;
  skills: readonly string[]; headline: string;
  email: string; phone: string | null;       // masked by API unless shortlisted
  isContactVisible: boolean;
  fairIds: readonly string[];
}

export interface Shortlist { id: string; employerId: string; candidateId: string; fairId: string; note: string | null; createdAt: string; candidate: Candidate; }

export interface InterviewSlot {
  id: string; fairId: string; employerId: string;
  startTime: string; endTime: string;
  candidateId: string | null; candidateName: string | null;
}

export interface KpiValue { value: number; deltaPct: number | null; }   // deltaPct: -1..1, null = no baseline

export interface DashboardSummary {
  upcomingFairs: KpiValue;        // count of fairs with status 'open' or 'live'
  boothFillRate: KpiValue;        // 0..1 across 'open' and 'live' fairs
  registrations: KpiValue;        // total across those fairs
  pipelineValueMyr: KpiValue;     // sum of dealValueMyr, stage >= proposal, excluding 'lost'
  boothFillByFair: readonly { fairId: string; fairName: string; boothTotal: number; boothAssigned: number; }[];
  pipelineByStage: readonly { stage: EmployerStage; count: number; valueMyr: number; }[];
}

export interface Paginated<T> { data: readonly T[]; meta: { currentPage: number; perPage: number; total: number; lastPage: number; }; }

export interface ApiError { status: number; message: string; fieldErrors: Readonly<Record<string, readonly string[]>>; }
```

## Testing strategy

| Layer | What | Priority |
|---|---|---|
| Stores | load success/error, optimistic update + rollback | High |
| Mock API handlers | filtering, pagination, 409/422 cases | High |
| Guards | role redirect | Medium |
| Pipes | mask-email, currency | Medium |
| Components | Only critical ones (booth tile states, filter form) | Low |

Use `provideHttpClientTesting()` + `HttpTestingController` for store tests.

## Security notes

- **Demo auth is not security.** The role switcher is client-side. Anything in the browser can be changed by the user. Real authorisation must be enforced by Laravel policies later.
- Angular escapes interpolated values by default; keep it that way (no `innerHTML`, no `bypassSecurityTrust*`).
- Future Laravel: Sanctum SPA cookie auth, CSRF via `XSRF-TOKEN` (Angular's `withXsrfConfiguration` reads it automatically), CORS locked to the frontend origin, rate limiting on auth routes.
- Future AI feature (roadmap R3): the LLM call must go through the Laravel backend. Never ship an API key in the frontend. Treat candidate data sent to an LLM as personal data under PDPA.
- Add a Content-Security-Policy header at the hosting level (Vercel/Netlify config) at deploy time.

## Moving to Laravel (roadmap R1)

1. Build Laravel endpoints matching the table above (API Resources give the same envelope).
2. Set `useMockApi: false` and `apiBaseUrl` to the Laravel URL in `environment.ts`.
3. Delete nothing in features. Only `core/mock-api/` becomes unused.
