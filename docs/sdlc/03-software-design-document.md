# Software Design Document — BankFair

## Document Control

| Field | Value |
|---|---|
| Project Name | BankFair |
| Document ID | SDD-001 |
| Version | 1.0 |
| Author | Amir Idlan |
| Date | 25/09/2026 |
| Status | Approved (retrospective) |

> **Retrospective.** This describes the system as built, not a design to be
> implemented. Where the built design differs from what a production system
> should do, it says so and points at the ADR or known issue.

---

## 1. Introduction

### 1.1 Purpose

The technical design of BankFair: how the application is structured, how data
flows through it, and what the backend replacing the mock API must provide.
Written for whoever maintains this code or implements that backend.

### 1.2 References

SRS-001, ADR-001…012, `docs/04-architecture.md`, `docs/05-mock-data.md`, and
the four rendered diagrams in `docs/diagrams/`.

---

## 2. Architecture Overview

### 2.1 Style

**Modular monolith, client-side.** One Angular application, lazily split by
feature, with a shared core. There is no server component: the "backend" is an
HTTP interceptor inside the same bundle.

That choice is the single most consequential one in the project (ADR-001). It
means the application is not a mock with a UI bolted on; it is a real frontend
talking real HTTP to something that happens to live in the same process. The
consequence is that swapping in Laravel deletes one interceptor and changes one
base URL.

### 2.2 Layers

```
┌───────────────────────────────────────────────────────────┐
│  Features (lazy)                                          │
│  dashboard · fairs · employers · applications ·           │
│  talent-pool · shortlist · interviews · job-seeker ·      │
│  settings                                                 │
│      ▲ components read signals            ▼ call methods  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Stores (13, signal-based, providedIn: 'root')      │  │
│  └─────────────────────────────────────────────────────┘  │
│      ▲ Observable → signal at this boundary               │
├───────────────────────────────────────────────────────────┤
│  Core                                                     │
│  ApiService · interceptor chain · AuthStore · guards      │
├───────────────────────────────────────────────────────────┤
│  HttpClient                                               │
├───────────────────────────────────────────────────────────┤
│  Interceptor chain (order matters)                        │
│  baseUrl → error → mockApi (last, short-circuits)         │
├───────────────────────────────────────────────────────────┤
│  Mock API (lazy chunk, 40.56 kB)                          │
│  engine → route table → 27 handlers → in-memory DB        │
│                       └→ audit recorder                   │
└───────────────────────────────────────────────────────────┘
```

Full diagrams: `docs/diagrams/01-architecture.md` and
`docs/diagrams/02-write-request.md`.

### 2.3 Technology stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Angular | 22.1 | Signals, zoneless, standalone components, built-in control flow |
| Language | TypeScript (strict) | 5.x | `any` banned; string-literal unions for enums |
| UI components | Angular Material + CDK | 22.1 | Dialogs, tables, drag-drop, form fields, overlays |
| Utility CSS | Tailwind CSS | 4.3 | Layout, spacing, typography on app-owned markup (ADR-002) |
| Component styles | SCSS | — | Per-component, emulated encapsulation |
| Charts | ng2-charts + chart.js | 10.x | Dashboard; deferred until scrolled into view |
| PDF parsing | pdfjs-dist | 6.3 | Browser-side CV import; v6 has no `eval` (ADR-008) |
| Tests | Vitest + jsdom | 4.0 | Via `@angular/build:unit-test`, what Angular 22 generates |
| Package manager | npm | — | `npm ci` only; npm 10's arborist cannot resolve this graph |
| Host | Netlify | — | Static, with CSP and MIME headers set in `netlify.toml` |
| **Target backend** | **Laravel + PostgreSQL** | **12 / 16** | Not built. The API contract in SRS §5.1 is written for it |

---

## 3. Component Design

### 3.1 Folder structure

```
src/app/
  core/           auth, http, models, fairs (shared rules), layout, mock-api
  features/       one folder per feature, each with its own *.routes.ts
  shared/         ui components, pipes
  styles/         _tokens.scss, _theme-colors.scss
```

`core/` holds everything more than one feature needs. A feature never imports
from another feature — where two needed the same logic, it moved to `core/` or
to a shared service (see §3.5).

### 3.2 State — signal stores

Thirteen stores, all `providedIn: 'root'`, all following one shape:

```ts
private readonly _things = signal<readonly Thing[]>([]);
private readonly _status = signal<LoadStatus>('idle');
private readonly _error  = signal<ApiError | null>(null);

readonly things = this._things.asReadonly();
readonly isLoading = computed(() => this._status() === 'loading');
readonly hasError  = computed(() => this._status() === 'error');
```

Rules held throughout:

- **Writable inside, readonly outside.** A component cannot reach past the store to mutate state.
- **Observables become signals at the store boundary.** Components read signals; nothing in `features/` subscribes.
- **Every API method handles its own errors** and sets `_error`. Nothing swallows.
- **Optimism is chosen per operation, not by default.** Withdrawing a registration is optimistic with rollback; registering is not, because registering is a consent event and claiming it before the server agreed would assert a consent that never happened.

Where a store serves two readers with different questions, it exposes two
slices rather than one contested one — `AuditStore` has both a filtered
`entries` for Settings and an unfiltered `recent` for the fair Overview,
specifically so one view cannot overwrite the other's filter.

### 3.3 Routing

Three role-scoped trees, guarded at the top with `canMatch`:

| Prefix | Role | Guard effect |
|---|---|---|
| `/staff/*` | staff | Other roles redirect to their own home |
| `/hiring/*` | employer | Route kept as "hiring" — the activity, not the role (ADR-005) |
| `/me/*` | job_seeker | |

`canMatch` rather than `canActivate` is deliberate: a route that cannot match
never downloads its bundle, so an employer's session never fetches the staff
chunks.

Every feature is `loadChildren`. Detail pages are shells with child routes per
tab, so each tab is linkable and refreshable. Modals are child routes too —
the routed component renders nothing and opens a dialog, so a candidate profile
or a registration detail survives a refresh and can be shared.

`withComponentInputBinding()` and `paramsInheritanceStrategy: 'always'` let a
shell and its tabs both take the route parameter as a signal input, with no
`ActivatedRoute` subscription anywhere.

### 3.4 Component conventions

Standalone only, `OnPush` everywhere, zoneless. `input()`/`output()`/`model()`
functions rather than decorators. `@if`/`@for`/`@switch`/`@defer` rather than
structural directives. `inject()` rather than constructor injection. Full rules
in `docs/sdlc/05-coding-standards.md`.

### 3.5 Shared services extracted to prevent drift

Two flows are offered from more than one place and are not simple API calls.
Each lives in one service, because two copies drift and the copy that drifts is
the one nobody tested:

| Service | Used by | Why it is not a plain call |
|---|---|---|
| `RegistrationDecisions` | Staff queue card, registration detail modal | Confirmation naming two side effects; a required reason; a 409 when someone else decided first |
| `FairRegistrationActions` | Seeker fair card, seeker fair Details tab | Consent collected before the request; confirmation before withdrawal; a 409 path; screen-reader announcements |

---

## 4. The mock API

### 4.1 Why it is an interceptor

A fake service injected in place of a real one would let mock-specific
assumptions leak into feature code, and would bypass the interceptor chain — so
the error interceptor, the case conversion and every store's error path would
never be exercised. As an interceptor registered last in the chain, it
short-circuits the request *after* everything above it has run, and failures
arrive as genuine `HttpErrorResponse` objects.

### 4.2 Request path

```
HttpClient
  → baseUrlInterceptor   prefixes the API base
  → errorInterceptor     maps failures to ApiError, snackbars non-422
  → mockApiInterceptor   dynamic import of the engine (keeps seed out of the initial bundle)
        → runMockRequest
             ├─ snapshot the target row        (before)
             ├─ matchRoute → handler → result
             ├─ recordAudit(before, after)     only on 2xx, only non-GET
             └─ toSnakeCase
        → 300–800ms simulated latency
  → HttpResponse or HttpErrorResponse
```

Audit recording happens at this single choke point rather than in handlers. A
handler cannot forget to log, and a new write route without an audit descriptor
fails the test suite (FR-91).

### 4.3 Case conversion

The wire is snake_case; handlers and components work in camelCase. Conversion
happens once each way, in the interceptor. This is not cosmetic — it is what
makes the Laravel swap a no-op for feature code, since Laravel's default
serialisation is snake_case.

A consequence worth knowing when writing tests: `expectOne(string)` in Angular's
`HttpTestingController` matches `urlWithParams`, so a request carrying query
parameters needs a predicate matcher.

### 4.4 Seed data

Deterministic from a fixed seed, so the demo is identical on every load and a
walkthrough can be rehearsed. 7 fairs, 60 employers, 280 booths, 300
candidates, 99 job openings, plus shortlists, interview slots, applications and
registrations.

**Each generator that was added later takes its own random stream.** Appending
to a shared stream shifts every number drawn after it — which silently dropped
one fair's booth fill from 40% to 1/40 when two fairs were added, and cost a
browser session to find.

Derived counts are computed from the source of truth rather than stated twice:
`boothAssigned` is counted from the booths, not taken from the fair's literal.

---

## 5. Database design — for the Laravel implementation

The mock holds plain arrays. This is the relational shape they imply.

### 5.1 Tables

| Table | Key columns | Notes |
|---|---|---|
| `fairs` | id, name, venue, city, description, start_date, end_date, status, booth_total, registrations, check_ins | `booth_assigned` should be derived, not stored |
| `booths` | id, fair_id FK, code, row, col, package, price_myr, employer_id FK NULL | Unique (fair_id, code); unique (fair_id, employer_id) if one booth per employer per fair |
| `employers` | id, name, industry, company_size, stage, lost_reason, contact_name, contact_email, contact_phone, booth_package, deal_value_myr, notes, timestamps | |
| `employer_fair` | employer_id FK, fair_id FK | Pivot replacing the mock's `fairIds` array |
| `candidates` | id, full_name, university, field_of_study, qualification, graduation_year, cgpa, skills, headline, email, phone, timestamps | `skills` as a related table or JSONB |
| `job_openings` | id, employer_id FK, title, job_function, employment_type, experience_level, location, skills, salary_min_myr, salary_max_myr, headcount, posted_at | |
| `job_opening_fair` | job_opening_id FK, fair_id FK | Pivot |
| `shortlists` | id, employer_id FK, candidate_id FK, fair_id FK, note, created_at | Unique (employer_id, candidate_id, fair_id) |
| `interview_slots` | id, fair_id FK, employer_id FK, start_time, end_time, candidate_id FK NULL | Unique (employer_id, start_time) |
| `fair_applications` | id, fair_id FK, employer_id FK, status, applied_at, decided_at, decided_by, rejection_reason | Unique (fair_id, employer_id) |
| `fair_registrations` | id, fair_id FK, candidate_id FK, registered_at, consented_at | Unique (fair_id, candidate_id). `consented_at` NOT NULL |
| `audit_entries` | id, at, actor_id, actor_name, actor_role, action, entity, entity_id, entity_label, method, path, changes | Append-only. Actor name copied in, not joined |

### 5.2 Two constraints that carry meaning

**`fair_registrations.consented_at` must be NOT NULL.** A registration cannot
exist without consent; making the column nullable would permit a row that PDPA
2010 does not.

**`audit_entries` must be append-only, and the actor's name copied rather than
joined.** A log that says "user u-emp-1" is useless once that user is gone, and
a trail that can be altered by editing another record is not a trail.

### 5.3 Indexes

| Table | Index | Rationale |
|---|---|---|
| `candidates` | (university), (field_of_study), (graduation_year), (cgpa) | The talent pool's four filters |
| `booths` | (fair_id, row, col) | Grid render order |
| `job_openings` | (job_function), (employment_type), (experience_level) | The Jobs tab's filters |
| `audit_entries` | (at DESC), (entity), (actor_id) | Newest-first read and its filters |
| `fair_applications` | (status, fair_id) | The pending queue |

---

## 6. Security Design

### 6.1 What exists, and what it stands in for

| Concern | Built | Production requirement |
|---|---|---|
| Authentication | A `sessionStorage` identity switcher, marked demo-only in code | Laravel Sanctum. See KI-01 |
| Authorisation | Role checks at the route (`canMatch`) **and** in every handler | Laravel policies. The handler checks are the ones that matter and should be ported |
| Refusal shape | 404, never 403 | Keep — a 403 confirms the record exists |
| Field-level access | Server-side masking (candidates) and a projection type (employers) | Keep both |
| Input validation | Server-side in handlers, mirroring Laravel's messages and 422 shape | Replace with Laravel validation; the client needs no change |
| XSS | No `innerHTML` with user data, no `bypassSecurityTrust*` | Keep |
| CSP | `script-src 'self'` in `netlify.toml` | Keep, extend for the API origin |
| Secrets | None in the frontend | Keep — cloud environment variables are visible to anyone with the environment |

### 6.2 The two field-level patterns, and when to use which

Both protect sensitive fields; they fail differently, and the project uses both
deliberately.

**Masking** (`maskForViewer`, candidates). The full object is returned with
sensitive values replaced. Right when the *same* consumer sometimes may and
sometimes may not see the values — an employer sees a candidate's email once
they shortlist them, and the object's shape must not change underneath the UI.

**Projection** (`FairExhibitor`, employers). A separate type is returned with
the sensitive fields absent entirely. Right when a consumer must *never* see
them. Masking would leave `dealValueMyr` on the object a component holds, and
nothing would stop a later template printing it; with a projection there is no
field to print. The guarantee is structural rather than behavioural (ADR-010).

**Both are enforced server-side.** A UI that masks is a UI that can be made to
stop masking.

---

## 7. Styling Architecture

Tailwind v4 and Angular Material coexist under a documented split, because
getting it wrong produces rules that silently do nothing.

**Layer order**, declared in `src/tailwind.css`:

```
theme → base (preflight) → components → fo-base → utilities → UNLAYERED
                                                              ↑ Material,
                                                                :focus-visible,
                                                                .fo-* helpers,
                                                                component styles
```

**Unlayered CSS beats every layer, whatever the specificity.** Tailwind emits
into layers; Material does not. A utility class on a Material component loses,
always. Hence the ownership split (ADR-002):

- Tailwind owns layout, spacing, grid and typography on markup the app writes.
- Material owns its own components, themed through `mat.theme()` and `mat.*-overrides()`.
- Never a utility to fight a Material internal, never `!important` to force one.

`fo-base` sits between components and utilities so app element defaults (`body`,
`h1`–`h3`) can still be overridden by a utility.

**Tailwind's default palette, type scale and radius scale are removed**
(`--color-*: initial`). `bg-blue-500`, `text-xl` and `rounded-lg` do not exist.
Only project tokens do — which enforces the no-hard-coded-colours rule
structurally rather than stating it (ADR-004).

**One caveat learned the hard way.** Material's component CSS is injected into
`<head>` at runtime, so it lands *after* `styles.scss`. A global helper tying
with a Material class at equal specificity loses on source order. Shared dialog
helpers are therefore qualified with the Material class they sit on.

---

## 8. Error Handling

| Layer | Behaviour |
|---|---|
| API | 404 not found and for refusals; 409 conflict; 422 validation, Laravel-shaped; 500 for simulated failure |
| `errorInterceptor` | Maps to `ApiError`; snackbars everything except 422, which belongs on a form |
| Store | Catches, sets `_error`, returns the error to the caller where the caller must react |
| Component | Renders `app-error-state` with Retry; 422 attaches to the originating control |
| Global | `ErrorHandler` logs unexpected errors to the console in dev only |

409 is handled as a normal outcome rather than a failure wherever it means
"someone got there first" — a duplicate application, a taken booth, an
already-decided application. The UI resynchronises and says what happened.

---

## 9. Build and Deployment

| Aspect | Detail |
|---|---|
| Build | `npm run build` — Angular CLI production build |
| Budget | 650 kB initial; currently 640.69 kB |
| Chunking | Every feature lazy; mock engine lazy (40.56 kB); pdf.js lazy (432.47 kB, loaded only on import) |
| Host | Netlify, static |
| Headers | CSP `script-src 'self'`; the pdf.js worker pinned to a JavaScript MIME type, cached `max-age=3600, must-revalidate` — **not** immutable, because its filename carries no content hash |
| CI | Lint, build and the full test suite must pass before any push |

Deployment is a static publish with no migration step and no rollback
complexity, because there is no server and no database. That changes entirely
once Laravel exists; a deployment plan is out of scope for this document set
and is listed in KI-08.

---

## 10. Design Decisions

Recorded separately as ADR-001 to ADR-012 in
`docs/sdlc/04-architecture-decision-records.md`.

## 11. Approval

Retrospective; see PC-001 §10.
