# Coding Standards — BankFair

| Field | Value |
|---|---|
| Document ID | CS-001 |
| Version | 1.0 |
| Date | 25/09/2026 |
| Status | Current — enforced |

These are the rules the codebase is actually held to. Most are enforced by the
compiler, the linter or a test rather than by review; where a rule is only
convention, it says so. The authoritative operational copy lives in
`CLAUDE.md` at the repository root, which this document formalises.

---

## 1. Enforcement — what checks what

| Rule class | Enforced by | Fails how |
|---|---|---|
| Type safety, no `any` | `tsc --strict` | Build fails |
| Lint rules, Angular idioms | `angular-eslint` | `npm run lint` fails |
| Bundle budget | Angular CLI | Build warns at 650 kB |
| Every write route audited | `handlers.spec.ts` | Test fails |
| No hard-coded colours | Tailwind config (ADR-004) | Class does not exist; build fails |
| Accessibility | axe-core in browser checks | Reported per surface |
| Four states per view | Convention + review | Not automated |
| Comment discipline | Convention + review | Not automated |

**Nothing may be pushed unless `npm run build`, `npm test -- --watch=false` and
`npm run lint` all pass with zero errors and no new warnings.**

---

## 2. TypeScript

- `strict: true`. **`any` is banned.** Use `unknown` and narrow it.
- String-literal unions for enums, never TypeScript `enum`:
  ```ts
  export type FairStatus = 'draft' | 'open' | 'live' | 'completed';
  ```
- `readonly` on arrays and on properties that should not mutate. Models are `readonly` throughout.
- API models are `interface` or `type` in `src/app/core/models/`. **No classes for data.**
- Prefer exhaustive `Record<Union, T>` lookups over `switch` for label maps, so adding a union member fails to compile rather than rendering a raw slug:
  ```ts
  const TYPE_LABEL: Readonly<Record<EmploymentType, string>> = { … };
  ```

## 3. Angular — modern only

| Rule | Instead of |
|---|---|
| Standalone components | `NgModule` — never create one |
| Omit `standalone: true` | It is the default in Angular 22 |
| `signal()`, `computed()`, `linkedSignal()` | Mutable class fields for state |
| `input()`, `output()`, `model()` | `@Input()` / `@Output()` decorators |
| `@if`, `@for` (always with `track`), `@switch`, `@defer` | `*ngIf`, `*ngFor` |
| `inject()` | Constructor injection |
| `ChangeDetectionStrategy.OnPush` on every component | Default change detection |
| Functional `CanActivateFn`, `ResolveFn`, `HttpInterceptorFn` | Class-based guards and interceptors |
| `class` / `style` bindings | `ngClass` / `ngStyle` |
| `host: {}` in the decorator | `@HostBinding` / `@HostListener` |
| Typed reactive forms, `FormBuilder.nonNullable` | Template-driven forms |
| `NgOptimizedImage` | Bare `<img>` for static images |

- Keep the zoneless setup the CLI generates. Do not add zone.js.
- Lazy-load every feature via `loadChildren` / `loadComponent` in `*.routes.ts`.
- Convert observables to signals **at the store boundary**. Components read signals; nothing in `features/` subscribes.

## 4. State — the store contract

Every store follows one shape:

```ts
@Injectable({ providedIn: 'root' })
export class ThingStore {
  private readonly api = inject(ApiService);

  private readonly _things = signal<readonly Thing[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error  = signal<ApiError | null>(null);

  readonly things    = this._things.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError  = computed(() => this._status() === 'error');

  async load(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);
    try { /* … */ this._status.set('success'); }
    catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }
}
```

- Writable signals private; public surface `.asReadonly()`.
- **Every method that calls the API handles its errors and sets `_error`. Nothing is swallowed.**
- Optimism is chosen per operation and justified in a comment. Default to not optimistic where the write asserts something about the user — consent especially.
- Two readers with different questions get two slices, not one contested one.

## 5. Error handling

- 422 maps to form field errors in Laravel's shape; everything else raises a snackbar via `errorInterceptor`.
- 409 is a normal outcome wherever it means "someone got there first": resynchronise and say what happened, do not report a failure.
- Every data view implements four states — **loading, empty, error-with-retry, loaded** — using the shared `app-skeleton`, `app-empty-state`, `app-error-state` components.
- An empty state says what belongs there and offers the action that creates the first one. A shrug and an icon is a wasted state.

## 6. Security

- Mock auth is demo-only and **must carry a code comment saying so**.
- Never `innerHTML` with user-supplied data. Never `bypassSecurityTrust*`.
- No secrets, API keys or tokens in frontend code or `environment.ts`. Cloud environment variables are visible to anyone with the environment.
- Authorisation refusals answer **404, never 403** — a 403 confirms the record exists.
- Field-level protection is enforced **server-side**, never in a template. Masking or projection per ADR-010.
- Never collect or display race, religion, health or disability (PDPA 2010).
- All demo data fictional: no real people, emails, phone numbers or company names. Real universities, cities and venues are acceptable as public places.

## 7. Styling

- Tailwind owns layout, spacing, grid, typography on app-owned markup. Material owns its own components.
- **Never a utility to fight a Material internal, and never `!important` to force one.** Unlayered beats every layer.
- `src/styles/_tokens.scss` is the single source of truth. `@theme` points at those custom properties; do not restate a value.
- No hard-coded hex values or magic pixel numbers in components — enforced structurally, since Tailwind's default palette does not exist.
- A global `.fo-*` helper that sits on a Material element must be qualified with that element's Material class, because Material's CSS is injected at runtime and wins ties on source order.
- Spacing is Tailwind's 4px scale, which *is* the project scale — note the numbering differs: `--fo-space-5` (24px) is Tailwind's `6`.

## 8. Accessibility — non-negotiable

- **Status is never carried by colour alone.** Every state has an icon or text as well.
- Every interactive element is keyboard-reachable with a visible focus state.
- Scrollable regions are focusable (`tabindex="0"` plus a label).
- State changes with no visual cue are announced with `LiveAnnouncer`.
- 44×44px touch targets on coarse pointers.
- No horizontal page scroll at 390px.
- Run axe-core against every new surface at 1440px and 390px before merging.

## 9. Naming

| Element | Convention | Example |
|---|---|---|
| Files | kebab-case | `fair-list.component.ts` |
| Components | PascalCase class, `app-` selector | `FairListComponent`, `app-fair-list` |
| Variables, functions | camelCase | `boothAssigned`, `isOpenForSignup()` |
| Types, interfaces | PascalCase | `FairExhibitor` |
| Constants | UPPER_SNAKE_CASE | `MAX_AUDIT_ENTRIES` |
| CSS helpers | `.fo-` prefix | `.fo-figure`, `.fo-caption` |
| Component-local CSS | BEM-ish | `.card__title`, `.card--matched` |
| API paths | kebab-case | `/fair-applications` |
| Wire fields | snake_case | `booth_assigned` |

One component per file. Templates and styles move to their own files once a
template exceeds ~20 lines.

## 10. Comments

The project's distinguishing convention, and the one that is pure discipline.

**Comment why, not what.** A comment restating the code is noise; a comment
explaining a decision is the only place that reasoning survives.

Comment when:

- A choice looks wrong until you know the constraint:
  ```ts
  // sessionStorage, not localStorage: the demo identity should last as long as
  // the tab and no longer. A new visitor opening the deployed demo starts as
  // staff, which is the intended first impression.
  ```
- A value was measured rather than guessed — record the measurement:
  ```scss
  // 140px clipped the labels to "Gradua…" and "Min CG…". Measured against the
  // longest label at the current type scale, not guessed.
  ```
- Something was tried and rejected — say so, so it is not retried:
  ```ts
  // Plain truncated text, not chips. Chips were wrapping to a second row,
  // which is what made rows 96px tall (docs/07 UX-3).
  ```
- A rule has a legal or safety reason:
  ```ts
  // The values were never written to the log, so there is nothing here to
  // reveal (docs/09 L2).
  ```

Do not leave commented-out code in a committed file.

## 11. Testing

- Vitest with jsdom, via `@angular/build:unit-test`.
- A test asserts a **behaviour or a guarantee**, not an implementation detail.
- The test name states the rule: `does NOT offer registration on a fair that ended but was left open`.
- **Mutation-check any test protecting a real guarantee**: break the rule deliberately and confirm the test fails. Applied to audit redaction, the employer projection, fair scoping and skill matching.
- Zoneless tests drive signal inputs with a `signal()` in the host, not a plain field.
- `expectOne(string)` matches `urlWithParams` — use a predicate for requests carrying query parameters.
- **A passing suite is not verification.** Several real defects passed every test and were found only by opening the page.

## 12. Git

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`.
- Small, logical commits. The message body explains *why*, and records what was measured and what was rejected.
- Work on a session branch; the default branch is fast-forwarded on approval.
- Never commit secrets.

## 13. Dependencies

**Do not add a dependency without asking, and measure it before adopting it.**
ADR-006 is the standing example: Material's progress components cost 21.55 kB
and pushed the bundle past budget, where CSS cost 1.77 kB. The import statement
gave no hint of that.

Current runtime dependencies: Angular, Angular Material + CDK, ng2-charts +
chart.js, pdfjs-dist. Nothing else.
