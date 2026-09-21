# 06 — Build Plan (7 days, Claude Code on the web)

One phase = one cloud session = one branch = one PR. Human steps for each phase are in `docs/00-cloud-setup.md`.

Every phase prompt ends with the same instruction, so it is written once here:

> **Standard ending:** When done, ensure `npm run build` and `npm test -- --watch=false` pass, commit with Conventional Commits, push the branch, then give me the end-of-phase summary described in CLAUDE.md (what was built, what to check on the deploy preview, concepts explained). Stop there.

---

## Locked decisions

Agreed before Phase 1a. Later sessions start with fresh context, so they are recorded here rather than left in a chat thread.

| # | Decision | Where it lands |
|---|---|---|
| D1 | The Angular project is named **`bank-fair`**, matching the repo. Netlify publishes `dist/bank-fair/browser` | Phase 1a |
| D2 | Interview slots are seeded only for `emp-001` and `emp-002` across `fair-01`–`fair-03`; other employers are generated on demand | Phase 2, `docs/05` |
| D3 | An **active-fair picker** in the top bar (hiring-manager role) scopes shortlists and interviews; defaults to the next upcoming fair | Phase 1b, `docs/04` |
| D4 | `/dashboard/summary` is a **single endpoint** returning `DashboardSummary` | Phase 1b (model) / Phase 3 (use), `docs/04` |

### Facts discovered during Phase 1a

- Angular 22 requires **Node ≥ 22.22.3**, not 22.12.0. The cloud VM ships 22.22.2, so the SessionStart hook installs a newer Node 22.x and symlinks it into `$HOME/.local/bin` (first on PATH). No environment setup script is needed — see `docs/00` troubleshooting for the fallback.
- `ng new` generates **Vitest 4 + jsdom** via `@angular/build:unit-test`, not Karma/Jasmine. `npm test -- --watch=false` still works.
- TypeScript 6 enables `strict` by default; `tsconfig.json` sets it explicitly anyway.
- npm 10 cannot resolve this dependency graph (`edgesOut` arborist bug). Use `npm ci`, or npm ≥ 11 for `npm install`.

### Facts discovered during Phase 1b

- `ng generate @angular/material:theme-color --directory=src/styles` writes `src/styles_theme-colors.scss` (no path separator) and exits 1 even though the file is correct. Move it into place afterwards.
- The `Environment` interface must live in its own file. `fileReplacements` swaps `environment.ts` for `environment.development.ts`, so a type declared in `environment.ts` would leave the development file importing its own replacement.
- `CanMatchFn` takes three arguments in Angular 22 (`route`, `segments`, `currentSnapshot`).
- The initial-bundle warning budget is **600kB** (raw), raised from Angular's generic 500kB default. The shell uses Material sidenav, toolbar, menu and snackbar on every route, which puts the floor near 520kB raw / 122kB transferred. The 1MB error budget is unchanged. Revisit in Phase 7.

### Facts discovered during Phase 3

- `provideCharts` at the application root pulls chart.js into the **initial** bundle (+217kB), defeating any `@defer` around a chart. `BaseChartDirective` injects its config with `optional: true` through the element injector, so the chart components provide it themselves.
- The mock engine must be behind a dynamic import. Importing `mock-db` statically from the interceptor shipped every seed word list on first load.
- The `docs/03` status palette **fails** the categorical colour checks: teal↔green ΔE 8.6 for normal vision (below the 15 floor) and red↔green 4.2 under deuteranopia. Charts therefore use one series in one hue with identity from axis labels. The status chips keep the palette — they carry a label and an icon and are never compared side by side.

### Facts discovered during Phase 4

- Budget raised again to **650kB**. Verified first that dialogs, drag-drop, reactive forms and radio are all in lazy chunks; the growth is shared CDK overlay and a11y primitives already reachable from the eager snackbar in `errorInterceptor`.
- The employer form lives in a dialog, not on a route, so the "dirty form" rule is enforced by the dialog rather than a `CanDeactivate` guard. It sets `disableClose` and routes Escape and backdrop clicks through the same confirmation as Cancel — `disableClose` on its own would have broken Escape, which dialogs are expected to honour.
- A dialog that closes with the edited entity cannot distinguish "saved a new one" from "cancelled", because the add case has no entity. The form closes with a boolean instead.

### Facts discovered during Phase 5b

- **`DatePipe` uses the browser's timezone, not `LOCALE_ID`.** Setting `LOCALE_ID` to `en-MY` fixes formats but not the zone, so a 10:00 interview slot rendered as "2:00 am" for a viewer outside GMT+8, and a late-evening timestamp would land on the wrong day. `DATE_PIPE_DEFAULT_OPTIONS` with `timezone: '+0800'` fixes every `date` pipe at once. Hand-rolled `toLocaleTimeString` calls need `timeZone: 'Asia/Kuala_Lumpur'` separately.
- The "no active fair" empty state on the hiring pages is only reachable when `/fairs` fails or returns no open or live fair — `FairContextStore` seeds a default otherwise.

### Facts discovered during Phase 6

- **`--fo-border-strong` measured 1.48:1 on white**, not the "≥3:1" `docs/03` claimed. It is the only thing distinguishing an empty booth or an open interview slot, so that was a WCAG 1.4.11 failure. Darkened to `#64748B` (4.76:1 / 4.55:1). Every other token pair was computed and passes; the script lives in the Phase 6 commit message rather than the repo, since it is a one-off audit tool.
- **Material buttons are 36px at density -1**, not the 44px `docs/03` asks for. 36px satisfies WCAG 2.2 AA (2.5.8 needs 24px), and density -1 exists precisely so operators can scan dense tables. The two only conflict on an imprecise pointer, so 44px is applied under `@media (pointer: coarse)` via `mat.button-overrides` rather than globally.
- Auditing by grep needs the grep to stay honest: test host components initially showed as "components without OnPush". A noisy signal is a useless one, so they were fixed rather than excluded.

### Facts discovered during Phase 7

- **Angular's critical-CSS inlining is incompatible with `script-src 'self'`.** `inlineCritical` rewrites the stylesheet link into `<link rel="stylesheet" media="print" onload="this.media='all'">`, and an inline event handler needs `'unsafe-inline'` — which would defeat the CSP. Set `optimization.styles.inlineCritical: false` in `angular.json`; the styles then load render-blocking, which for a 16kB sheet is the cheaper trade.
- **`style-src` still needs `'unsafe-inline'`.** Angular Material writes inline `style` attributes at runtime (overlay positioning, ripple geometry, sidenav transforms), and Angular's own style bindings do the same. There is no nonce path for attribute styles, so this is unavoidable today. It is a far smaller exposure than script injection: the risk is defacement, not code execution, and `script-src 'self'` with `object-src 'none'` and `base-uri 'self'` keeps the actual XSS surface closed.
- **CSS custom properties are not enough to fix contrast inside Material components.** The top-bar trigger rendered at 1.07:1. Overriding `--mat-*` tokens from the parent failed (emulated encapsulation scopes the rule to the parent's own elements, not the button's internals), and a token override on the trigger itself was still beaten by Material's own more specific rule. The fix is to set `color` directly on the elements the component owns — the `mat-icon` and the label `span`. That also forced the three top-bar components' styles out of inline `styles:` and into `.scss` files, because inline styles cannot `@use` the Material mixins.
- **The accessibility audit ran headless and found nothing.** Playwright + `@axe-core/playwright` against the production build, served behind the real `netlify.toml` headers: **0 violations across 10 pages** in both roles, and **0 CSP violations**. Google Fonts is blocked by the sandbox proxy (`ERR_CERT_AUTHORITY_INVALID`), so icons render as ligature text in that environment only — not an app fault.
- The audit harness was installed in the session scratchpad, not the repo. Making it a permanent `npm run a11y` script means adding Playwright and axe as devDependencies, which `CLAUDE.md` says to ask about first.
- Final production build: **625.08 kB raw / 154.01 kB transferred**, inside the 650kB warning budget with no warnings.

---

## Phase 0 — Docs ✅
`CLAUDE.md` + `docs/` uploaded to the repo `main` branch.

---

## Phase 1 — Bootstrap & foundation (Day 1–2)

Split into two sessions to keep each one focused.

### Phase 1a — Scaffold (session 1)

**Prompt**
> Read CLAUDE.md and docs/04-architecture.md. Do Phase 1a:
> 1. Check `node -v`. If below 22.22.3, stop and tell me.
> 2. Scaffold Angular 22 **in the repo root** (keep CLAUDE.md and docs/): `npx -y @angular/cli@22 new bank-fair --directory . --skip-git --style=scss --ssr=false --defaults`. If the CLI refuses a non-empty directory, scaffold into a temp folder and move the files in.
> 3. Add Angular Material + CDK (`npx ng add @angular/material --skip-confirmation --defaults`), `ng2-charts`, `chart.js`, and angular-eslint (`npx ng add @angular-eslint/schematics --skip-confirmation`).
> 4. Create `.mcp.json` registering the Angular CLI MCP server: `{"mcpServers":{"angular-cli":{"command":"npx","args":["-y","@angular/cli@22","mcp"]}}}`.
> 5. Create `.claude/settings.json` with a SessionStart hook (matcher `startup|resume`) running `bash "$CLAUDE_PROJECT_DIR"/scripts/cloud-session-start.sh`. The script exits 0 unless `CLAUDE_CODE_REMOTE=true`, then runs `npm ci` only if `package.json` exists and `node_modules` is missing. It must always exit 0.
> 6. Create `.nvmrc` containing `22`, and add `"engines": { "node": ">=22.22.3" }` to package.json.
> 7. Create `netlify.toml`: build command `npm run build`, publish `dist/bank-fair/browser`, SPA redirect `/* → /index.html 200`, and security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` disabling camera/microphone/geolocation). Leave CSP for Phase 7.
> 8. Add a README stub (project name, one-line description, "built with Angular 22").
>
> Standard ending.

**Then (you):** Create the PR → connect Netlify (see 00-cloud-setup.md) → confirm the deploy preview shows the default Angular page → merge.

### Phase 1b — Foundation (session 2)

**Prompt**
> Read CLAUDE.md, docs/03-design-system.md, and docs/04-architecture.md. Do Phase 1b: design tokens (`src/styles/_tokens.scss`), Material 3 theme with brand palettes (generate with `ng generate @angular/material:theme-color` non-interactively), Google Fonts, en-MY locale and date/currency setup, folder structure, all models, ApiService with snake_case↔camelCase conversion, ApiError mapping, base-url and error interceptors, global ErrorHandler, AuthStore with demo role switcher, role guards, Shell layout (top bar, responsive side nav, role switcher), shared UI components (page-header, empty-state, error-state, skeleton, status-chip, kpi-card), placeholder pages for every route, and a not-found page. Unit tests for ApiService case conversion, ApiError mapping, and role guard.
>
> Standard ending.

**Check on preview:** role switch changes nav and redirects; side nav collapses at tablet and mobile widths (resize the browser); fonts and colours match docs/03.

**Concepts to explain**
- Standalone components vs NgModules
- `signal`, `computed`, and why signals need no manual subscription
- Functional interceptors and their order
- Lazy loading with `loadChildren`

---

## Phase 2 — Mock API & seed data (Day 2)

**Prompt**
> Read CLAUDE.md, docs/05-mock-data.md, and the API contract in docs/04-architecture.md. Implement `core/mock-api/`: seeded PRNG, seed generators, in-memory DB, handlers for every endpoint, latency, 404/409/422 behaviour, simulated-error toggle, `/demo/reset`, and a "Reset demo data" item in the role menu. Register the interceptor only when `environment.useMockApi` is true (true in all environments for now, including production, since the deployed demo has no backend). Unit tests for candidate filtering/pagination, 409 conflicts, and 422 validation. Add a temporary debug page at `/staff/debug` listing record counts per table so I can verify on the preview; mark it with a TODO to remove in Phase 6.
>
> Standard ending.

**Check on preview:** `/staff/debug` shows the expected counts; reloading shows identical data.

**Concepts to explain**
- Why the mock is an interceptor (swap to Laravel without touching features)
- `HttpResponse` vs `HttpErrorResponse`, `of()` / `throwError()` / `delay()`

---

## Phase 3 — Dashboard & Fairs (Day 3)

**Prompt**
> Read CLAUDE.md, docs/01, docs/02, docs/03. Implement M1 Dashboard and M2 Fairs. Dashboard: 4 KPI cards, booth fill-rate bar chart per upcoming fair, pipeline value by stage chart; each widget has independent loading/error states; charts in `@defer` blocks. Fairs: list with status/city filters, fair detail with tabs (Overview, Floor plan placeholder, Employers). Follow the FairsStore pattern in docs/04. Store tests.
>
> Standard ending.

**Check on preview:** turn on simulated errors and confirm each widget fails independently with Retry.

**Concepts to explain**
- Store pattern: private writable signals, public readonly
- `@for` with `track`, `@if` / `@else`, `@defer`
- `withComponentInputBinding()` for route params

---

## Phase 4 — Floor plan & Employer pipeline (Day 4)

**Prompt**
> Read CLAUDE.md and docs/02 flows F1, F2, F3. Implement M3 Floor plan and M4 Employer pipeline: CDK drag-drop with optimistic updates and rollback, keyboard alternatives for every drag action, LiveAnnouncer messages, Undo snackbar, replace-booth confirm dialog, Lost-reason dialog, add/edit employer typed reactive form with 422 field mapping and a dirty-form guard. Tests for optimistic update and rollback.
>
> Standard ending.

**Check on preview:** drag-assign a booth and Undo; complete the same action with keyboard only (Tab / Enter); move a card to Lost.

**Concepts to explain**
- Optimistic UI and rollback
- Typed reactive forms, validators, mapping server errors to fields
- Why drag-and-drop needs a keyboard path

---

## Phase 5a — Talent pool & Shortlist (Day 5)

Phase 5 was split in two: three modules plus URL-param state, debounced search, server-side pagination and deep-linked drawers is roughly double any other phase.

**Prompt**
> Read CLAUDE.md and docs/02 flow F4. Implement M5 Talent pool and the Shortlist view: filters synced to URL query params, debounced search, server-side sort/pagination with mat-table, deep-linkable profile drawer, contact masking until shortlisted, 409 on duplicate shortlist. Shortlists scope to the active fair from the top-bar picker (D3). Store tests.
>
> Standard ending.

**Check on preview:** apply filters, copy the URL into a new tab (same results); shortlist a candidate and see contact details unmask.

**Concepts to explain**
- Query params as state (shareable, refresh-safe)
- Debouncing search input
- Server-side vs client-side pagination

---

## Phase 5b — Interview slots (Day 5)

**Prompt**
> Read CLAUDE.md and docs/02 flow F5. Implement M6 Interviews: slot grid per fair day (20-min slots, 10:00–17:00) for the active fair, book a shortlisted candidate into an open slot, cancel with a confirm dialog, 409 handling that refreshes the grid, and the "shortlist candidates first" branch when the shortlist is empty. Store tests.
>
> Standard ending.

**Check on preview:** book a slot and cancel it; open Interviews with an empty shortlist and confirm the branch.

**Concepts to explain**
- Handling a 409 conflict as a normal outcome, not an error state
- Deriving a slot grid from times rather than storing a grid

---

## Phase 6 — Polish & quality (Day 6)

**Prompt**
> Audit the whole app against docs/02 (states, microcopy, accessibility checklist) and docs/03 (tokens, no hard-coded colours). Fix issues. Verify keyboard-only navigation of every flow and reduced-motion handling. Remove the `/staff/debug` page. Grep for and remove any `any`, `*ngIf`, `*ngFor`, `@Input(`, `@Output(`, `ngClass`, `ngStyle`. Add missing tests for guards and pipes. Write the full README: features, screenshots placeholders, tech decisions, how it was built (Claude Code on the web, docs-driven), architecture diagram in Mermaid, roadmap including the Laravel backend and the planned AI feature.
>
> Standard ending.

**Check on preview (you):**
- Chrome DevTools → Lighthouse → Accessibility ≥ 95 on Dashboard, Talent pool, Employers. (DevTools is built into the browser; nothing to install.)
- Resize to phone width and click through every page.
- If your work device blocks DevTools, ask Claude to run a headless accessibility check instead (see Phase 7 note).

---

## Phase 7 — Hardening & rehearse (Day 7)

**Prompt**
> Add a Content-Security-Policy to `netlify.toml` that allows only self plus fonts.googleapis.com (styles) and fonts.gstatic.com (fonts), with `frame-ancestors 'none'`, and make sure the app still works (inline styles from Angular Material may need `style-src 'self' 'unsafe-inline'`; explain the trade-off). Ensure production build budgets pass. If feasible within the network allowlist, run an automated accessibility check (e.g. axe with Playwright using the pre-installed Chrome driver) against the production build and fix issues.
>
> Standard ending.

**Then (you):**
- Merge; open the production URL on laptop and phone.
- Rehearse the demo script 3 times, under 7 minutes.

### Demo script (~6 min)
1. **Context (30s):** "I built an ops portal based on how I understand your business: selling booths, managing employers, connecting employers to talent."
2. **Staff (2.5 min):** Dashboard → live fair → floor plan drag-assign (show Undo) → pipeline drag to Paid → show the keyboard alternative.
3. **Hiring manager (2 min):** Switch role → filter talent pool (show URL params) → shortlist → contact unmasks → book an interview slot.
4. **Engineering (1 min):** Turn on simulated errors → show error states and Retry. Explain the mock interceptor and the Laravel swap.
5. **How I built it (30s):** Docs-first, AI-agent-assisted development with Claude Code, reviewed through PRs and deploy previews. Be ready to explain any concept above.
6. **Roadmap (30s):** Laravel + Sanctum, AI candidate matching (server-side), candidate portal with QR check-in.
7. **Ask:** "How does your team manage bookings and booth allocation today?"

---

## Future phases (not scheduled)
- R1 Laravel 12 + PostgreSQL API · R2 Sanctum auth · **R3 AI feature (scope TBD by developer)** · R4 Candidate portal · R5 Bahasa Malaysia · R6 SSR for public pages
