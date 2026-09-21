# 06 — Build Plan (7 days, Claude Code on the web)

One phase = one cloud session = one branch = one PR. Human steps for each phase are in `docs/00-cloud-setup.md`.

Every phase prompt ends with the same instruction, so it is written once here:

> **Standard ending:** When done, ensure `npm run build` and `npm test -- --watch=false` pass, commit with Conventional Commits, push the branch, then give me the end-of-phase summary described in CLAUDE.md (what was built, what to check on the deploy preview, concepts explained). Stop there.

---

## Phase 0 — Docs ✅
`CLAUDE.md` + `docs/` uploaded to the repo `main` branch.

---

## Phase 1 — Bootstrap & foundation (Day 1–2)

Split into two sessions to keep each one focused.

### Phase 1a — Scaffold (session 1)

**Prompt**
> Read CLAUDE.md and docs/04-architecture.md. Do Phase 1a:
> 1. Check `node -v`. If below 22.12.0, stop and tell me.
> 2. Scaffold Angular 22 **in the repo root** (keep CLAUDE.md and docs/): `npx -y @angular/cli@22 new fairops --directory . --skip-git --style=scss --ssr=false --defaults`. If the CLI refuses a non-empty directory, scaffold into a temp folder and move the files in.
> 3. Add Angular Material + CDK (`npx ng add @angular/material --skip-confirmation --defaults`), `ng2-charts`, `chart.js`, and angular-eslint (`npx ng add @angular-eslint/schematics --skip-confirmation`).
> 4. Create `.mcp.json` registering the Angular CLI MCP server: `{"mcpServers":{"angular-cli":{"command":"npx","args":["-y","@angular/cli@22","mcp"]}}}`.
> 5. Create `.claude/settings.json` with a SessionStart hook (matcher `startup|resume`) running `bash "$CLAUDE_PROJECT_DIR"/scripts/cloud-session-start.sh`. The script exits 0 unless `CLAUDE_CODE_REMOTE=true`, then runs `npm ci` only if `package.json` exists and `node_modules` is missing. It must always exit 0.
> 6. Create `.nvmrc` containing `22`, and add `"engines": { "node": ">=22.12.0" }` to package.json.
> 7. Create `netlify.toml`: build command `npm run build`, publish `dist/fairops/browser`, SPA redirect `/* → /index.html 200`, and security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` disabling camera/microphone/geolocation). Leave CSP for Phase 7.
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

## Phase 5 — Talent pool, Shortlist, Interviews (Day 5)

**Prompt**
> Read CLAUDE.md and docs/02 flows F4, F5. Implement M5 Talent pool, Shortlist view, and M6 Interviews: filters synced to URL query params, debounced search, server-side sort/pagination with mat-table, deep-linkable profile drawer, contact masking until shortlisted, 409 handling for slot conflicts. Store tests.
>
> Standard ending.

**Check on preview:** apply filters, copy the URL into a new tab (same results); shortlist a candidate and see contact details unmask; book and cancel a slot.

**Concepts to explain**
- Query params as state (shareable, refresh-safe)
- Debouncing search input
- Server-side vs client-side pagination

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
