# CLAUDE.md — FairOps

Instructions for Claude Code. Read this file fully before any task. Then read the relevant file in `docs/`.

## Project

FairOps is a career fair operations portal. It serves two roles:

- **Staff** (career fair organiser team): manage fairs, booths, and the employer sales pipeline.
- **Hiring manager** (employer client): browse the candidate talent pool, shortlist, and book interview slots.

It is a **frontend-only demo** backed by a **mock HTTP API** with dummy data. A Laravel 12 + PostgreSQL backend will replace the mock later, so the frontend must talk to it only through `HttpClient`.

## Environment (read first)

This project is developed with **Claude Code on the web** (cloud sessions at claude.ai/code). The developer has no local machine setup.

- Each session runs in a fresh Ubuntu 24.04 VM with the repo cloned. Node.js 22 is on `PATH`.
- **Angular 22 requires Node.js ≥ 22.22.3** (the CLI hard-fails below it — higher than the ≥ 22.12.0 originally assumed). The cloud VM ships **22.22.2**, one patch short. The SessionStart hook (`scripts/cloud-session-start.sh`) fixes this automatically by installing the newest Node 22.x and symlinking it into `$HOME/.local/bin`, which precedes `/opt/node22/bin` on PATH. Still run `node -v` at the start of a session; if it is below 22.22.3 the hook failed, and the fallback is the environment setup script in `docs/00-cloud-setup.md`.
- **npm 10 cannot install this dependency graph** (`Cannot read properties of null (reading 'edgesOut')`, an arborist peer-resolution bug hit by vitest's peers). Use `npm ci` — it reifies straight from `package-lock.json` and is unaffected. Only `npm install` needs npm ≥ 11.
- The developer **cannot view `localhost`**. Never ask them to open `http://localhost:4200`. Verify your work with `npm run build`, `npm test`, and lint instead. The developer reviews the UI through the **Netlify deploy preview** on the pull request.
- Do not leave long-running processes (like `ng serve`) running at the end of a task.
- Network access is the "Trusted" allowlist: npm registry, GitHub, and Google Fonts work; most other domains do not.
- Every command must be **non-interactive**. Pass flags such as `--defaults`, `--skip-confirmation`, `--interactive=false`, or pipe answers. If a CLI still prompts, find the flag rather than guessing input.
- Each session works on its own branch and pushes it when done. The developer merges the PR on GitHub.

## Docs index

| File | Read when |
|---|---|
| `docs/00-cloud-setup.md` | Human setup steps (GitHub, cloud environment, Netlify). Reference only |
| `docs/01-project-overview.md` | Scope, roles, modules, roadmap |
| `docs/02-ux-flows.md` | Building any screen or flow |
| `docs/03-design-system.md` | Styling, theming, any visual work |
| `docs/04-architecture.md` | Folder structure, routing, state, API, models |
| `docs/05-mock-data.md` | Seed data and the mock API |
| `docs/06-build-plan.md` | Current phase, tasks, acceptance criteria |

## Stack

- Angular 22 (latest stable), TypeScript strict mode, SCSS
- Angular Material 3 + Angular CDK (drag-drop)
- ng2-charts + chart.js for dashboard charts
- npm
- Tests: **Vitest 4** with jsdom, via the `@angular/build:unit-test` builder (what `ng new` generates in Angular 22 — no longer Karma/Jasmine)

## Commands

```bash
npm run build                  # production build — must pass before every push
npm test -- --watch=false      # unit tests, single run (never leave watch mode running)
npm run lint                   # lint (angular-eslint)
npx ng <command>               # use the project-local CLI; do not rely on a global install
```

## Angular rules (modern Angular only)

- Standalone components only. Never create `NgModule`s.
- Do not set `standalone: true` explicitly; it is the default.
- Use signals for component and service state: `signal()`, `computed()`, `linkedSignal()` where needed.
- Use `input()`, `output()`, `model()` functions. Never `@Input()` / `@Output()` decorators.
- Use built-in control flow: `@if`, `@for` (always with `track`), `@switch`, `@defer`. Never `*ngIf` / `*ngFor`.
- Use `inject()` for DI. No constructor injection.
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- Keep whatever change-detection setup `ng new` generates (zoneless if generated). Do not add zone.js manually.
- Functional guards, resolvers, and interceptors only (`CanActivateFn`, `ResolveFn`, `HttpInterceptorFn`).
- Lazy-load every feature via `loadChildren` / `loadComponent` in `*.routes.ts` files.
- Typed reactive forms (`FormBuilder.nonNullable`). No template-driven forms.
- Use `class` / `style` bindings. Never `ngClass` / `ngStyle`.
- Use `host: {}` in the decorator. Never `@HostBinding` / `@HostListener`.
- Convert HTTP observables to signals at the store boundary with `toSignal()` or by subscribing inside store methods. Components should read signals, not subscribe.
- Use `NgOptimizedImage` for static images.
- If unsure about an API, use the `angular-cli` MCP server (configured in `.mcp.json`) for official best practices and docs before guessing.

## TypeScript rules

- `strict: true`. Never use `any`. Use `unknown` and narrow it.
- All API models live in `src/app/core/models/` as `interface` / `type`. No classes for data.
- Use string-literal union types for enums (for example, `type FairStatus = 'draft' | 'open' | 'live' | 'completed'`).
- Prefer `readonly` for arrays and properties that should not mutate.

## Error handling

- Every store method that calls the API must handle errors and set an `error` signal. Never swallow errors silently.
- The global `errorInterceptor` maps HTTP errors to an `ApiError` type and shows a `MatSnackBar` for non-422 errors.
- 422 validation errors map to form field errors (Laravel format: `{ message, errors: { field: string[] } }`).
- Every data view has 4 states: **loading**, **empty**, **error** (with Retry), and **loaded**. Use the shared components.
- Provide a global `ErrorHandler` that logs unexpected errors to the console in dev only.

## Security rules

- Mock auth is **demo only**. Put a code comment on it saying so. Real auth comes from Laravel Sanctum later.
- Never use `innerHTML` with user-supplied data. Never call `bypassSecurityTrust*`.
- No secrets, API keys, or tokens in the frontend code or `environment.ts`.
- All dummy data is fictional. No real people, emails, or phone numbers. Use fictional company names.
- Mask candidate emails and phone numbers in list views (`a***@example.com`). Show full contact details only after shortlisting.
- Do not collect or display sensitive personal data (race, religion, health, disability status). This follows the Malaysian PDPA 2010.

## Locale (Malaysia)

- `LOCALE_ID` = `en-MY` (register locale data).
- Dates display as `DD/MM/YYYY` (`dd/MM/yyyy` pipe format). Times display as `h:mm a`.
- Currency is `MYR`, shown as `RM` (for example, `RM 3,500.00`).
- Timezone is Asia/Kuala_Lumpur (GMT+8). Store ISO 8601 strings with offset `+08:00` in mock data.
- Datepicker uses `MAT_DATE_LOCALE` = `en-GB` so input parses as DD/MM/YYYY.

## Code style

- File naming: `kebab-case`. Component suffix pattern: `fair-list.component.ts` (keep the CLI's default naming if it differs, but be consistent).
- One component per file. Templates and styles in separate files once a template exceeds ~20 lines.
- Use design tokens (CSS custom properties from `docs/03-design-system.md`). No hard-coded hex values or magic pixel numbers in components.
- Every interactive element must be keyboard-accessible with a visible focus state.

## Workflow

- Work one phase from `docs/06-build-plan.md` per session. Stop at the end of the phase.
- Before pushing: `npm run build` and `npm test -- --watch=false` must pass with zero errors and no new warnings.
- Commit in small logical steps with Conventional Commit messages (`feat: add fair list page`), then push the session branch.
- End every phase with a short summary for the developer:
  1. What was built (files and features).
  2. What to check on the Netlify deploy preview (specific pages and interactions).
  3. The "Concepts to explain" for that phase from `docs/06-build-plan.md`, each explained in 2–3 plain sentences with a pointer to the file where it is used.
- Do not add a dependency that is not listed in this file without asking first.
- Never commit secrets. Cloud environment variables are visible to anyone using the environment.
