# Architecture Decision Records — BankFair

| Field | Value |
|---|---|
| Document ID | ADR-SET-001 |
| Version | 1.0 |
| Date | 25/09/2026 |
| Status | Current |

Twelve decisions that shaped the system. Each was made during the build and
recorded in the phase plan at the time; this collects them in ADR form with
the consequences as they actually played out, including where a decision
turned out to cost something.

| # | Decision | Status |
|---|---|---|
| [ADR-001](#adr-001) | Mock API as an HTTP interceptor | Accepted |
| [ADR-002](#adr-002) | Split cascade ownership between Tailwind and Material | Accepted |
| [ADR-003](#adr-003) | Demo identity switcher instead of authentication | Accepted (demo only) |
| [ADR-004](#adr-004) | Delete Tailwind's default palette and scales | Accepted |
| [ADR-005](#adr-005) | Rename the role, keep the route | Accepted |
| [ADR-006](#adr-006) | CSS loading indicators, not Material's | Accepted |
| [ADR-007](#adr-007) | Approval moves the pipeline stage | Accepted (demo only) |
| [ADR-008](#adr-008) | Parse the CV in the browser | Accepted |
| [ADR-009](#adr-009) | Redact personal fields at the recording layer | Accepted |
| [ADR-010](#adr-010) | Projection type over masking for employer data | Accepted |
| [ADR-011](#adr-011) | "Attending" means holding a booth | Accepted |
| [ADR-012](#adr-012) | Signal stores rather than a state library | Accepted |

---

<a id="adr-001"></a>
## ADR-001: Serve the API from an HTTP interceptor

**Status** Accepted · **Date** 21/09/2026

### Context

The project needed a working application with no backend, built so that a real
Laravel API could replace the fake one later without rewriting features. The
obvious approach — a service returning hard-coded observables, injected in
place of a real one — was available and cheaper.

### Decision

Serve every request from an Angular `HttpInterceptorFn` registered last in the
chain, backed by an in-memory database and a route table of 27 endpoints.
Features call `HttpClient` exactly as they will against Laravel.

### Options considered

| Option | Pros | Cons |
|---|---|---|
| Fake service | Simplest; no HTTP machinery | Mock assumptions leak into features; error paths, interceptors and case conversion never exercised; the swap becomes a rewrite |
| MSW (Mock Service Worker) | Realistic; intercepts at the network layer | Another dependency; service-worker lifecycle to manage; no advantage here |
| **HTTP interceptor** | Features are indistinguishable from production; the whole interceptor chain runs; failures are real `HttpErrorResponse` | More scaffolding; the route table must be maintained |

### Consequences

- The error interceptor, case conversion and every store's error path are genuinely exercised, because failures arrive as real HTTP errors.
- The swap to Laravel is deleting one interceptor and changing a base URL.
- It forced the API contract to be designed properly up front — snake_case wire format, `{ data, meta }` envelopes, Laravel's 422 shape — rather than shaped by whatever was convenient.
- **Cost:** the mock is a real piece of software with its own tests. `handlers.spec.ts` is the largest spec file in the project at 131 tests. That is maintenance for code that will eventually be deleted.

---

<a id="adr-002"></a>
## ADR-002: Split cascade ownership between Tailwind and Material

**Status** Accepted · **Date** 21/09/2026

### Context

Tailwind v4 emits all its CSS inside `@layer`. Angular Material's styles are
unlayered. **Unlayered CSS beats every layer regardless of specificity**, so a
Tailwind utility on a Material element silently does nothing — no error, no
warning, just a rule that never applies. Phase 7 had already lost time to this.

### Decision

Divide ownership explicitly. Tailwind owns layout, spacing, grid and typography
on markup the app writes. Material owns its own components, themed only through
`mat.theme()`, `mat.*-overrides()`, or by styling elements the component itself
owns. Never a utility to fight a Material internal; never `!important`.

### Consequences

- The cascade became predictable, and "why is this class doing nothing" stopped being a recurring question.
- **This rule was breached twice and both breaches shipped before being caught.** A dialog header's `justify-content: space-between` interacted with Material's own `::before` pseudo-element to indent every dialog title by 196px — it looked centred and was not. And a shared helper tying with a Material class at equal specificity lost on source order, because Material's component CSS is injected at runtime and lands after `styles.scss`.
- The corollary, learned from the second: *cooperating* with a Material internal still needs its specificity checked rather than assumed.

---

<a id="adr-003"></a>
## ADR-003: A demo identity switcher instead of authentication

**Status** Accepted, **demo only** · **Date** 21/09/2026

### Context

The application needs three roles with genuinely different views and
permissions. Real authentication needs a server, a user store and a session
mechanism — none of which exist.

### Decision

Four fixed demo identities, switchable from the top bar with no credentials,
persisted in `sessionStorage`. Every occurrence is commented as demo-only.
Authorisation is still enforced properly: route guards *and* a role check in
every handler.

### Consequences

- A reviewer can see all three roles in seconds, which is the point of a portfolio demo.
- Because authorisation is checked in the handlers and not only at the route, those checks port directly to Laravel policies. The guards are convenience; the handler checks are the rule.
- `sessionStorage` rather than `localStorage` so the identity lasts the tab and no longer — a new visitor opens the demo as staff, which is the intended first impression.
- **Cost:** this is the single largest gap between the demo and a real system, and the one most likely to be misread as "it has auth". Hence KI-01.

---

<a id="adr-004"></a>
## ADR-004: Delete Tailwind's default palette, type scale and radius scale

**Status** Accepted · **Date** 21/09/2026

### Context

The project rule "no hard-coded hex values or magic pixel numbers in
components" is easy to state and easy to break — `bg-blue-500` is right there,
and nothing stops it.

### Decision

`--color-*: initial`, `--text-*: initial`, `--radius-*: initial` in the
`@theme` block, then re-add only project tokens, each pointing at
`src/styles/_tokens.scss`.

### Consequences

- `bg-blue-500`, `text-xl` and `rounded-lg` do not exist. Reaching for one fails the build rather than passing review.
- The rule is enforced structurally rather than stated — the strongest form available.
- `_tokens.scss` stays the single source of truth; `@theme` points at it rather than restating values, so the two cannot drift.
- **Cost:** a contributor who knows Tailwind will try a default class and be confused when nothing happens. Documented in `CLAUDE.md` and in the stylesheet itself.

---

<a id="adr-005"></a>
## ADR-005: Rename the role, keep the route

**Status** Accepted · **Date** 21/09/2026

### Context

S1 renamed `hiring_manager` to `employer` and added `job_seeker`. The employer
section lived at `/hiring/*`, and ~30 files plus every route test referenced it.

### Decision

Rename the role in the type system — two names for one concept is exactly the
drift the project forbids. Leave the routes at `/hiring/*`.

### Consequences

- The type rename was contained: 15 files, 7 of them in `src`, caught by the compiler.
- "Hiring" is the activity, not the role, so the URL is still accurate. Renaming it would have touched thirty files and every route test to produce nothing a user can see.
- Job seekers got `/me/*`, which reads correctly for a section that is about oneself.

---

<a id="adr-006"></a>
## ADR-006: Write loading indicators in CSS rather than adopting Material's

**Status** Accepted · **Date** 22/09/2026

### Context

A1 needed a route progress bar and a button spinner. `mat-progress-bar` and
`mat-progress-spinner` were the obvious choice.

### Decision

Write both in CSS. Measured, not assumed:

| Option | Initial bundle |
|---|---|
| Material progress bar + spinner | **661.34 kB** — past the 650 kB budget |
| Material progress bar alone | still over |
| **CSS pair** | **1.77 kB** |

### Consequences

- The budget held. The bundle is 640.69 kB today with everything since added.
- The spinner draws in `currentColor`, so it reads correctly on a filled button, a tinted tile and a white card without being told about any of them.
- It slows rather than stops under `prefers-reduced-motion`: a still ring reads as a broken icon, and the element's whole purpose is to say something is happening.
- **Generalisation worth keeping:** measure before adopting. The 21.55 kB was not obvious from the import statement.

---

<a id="adr-007"></a>
## ADR-007: Approving an application also confirms the employer

**Status** Accepted, **demo only** · **Date** 22/09/2026

### Context

The floor plan seats only employers at stage `confirmed` or `paid`. Approving a
fair application made an employer "attending" but left them at `lead`, so they
could not be given a booth — a dead end in the middle of the demo's main path.

### Decision

Approval sets the stage to `confirmed`, and the confirmation dialog names both
effects so staff know what they are doing.

### Consequences

- The demo's main path works end to end: apply → approve → seat on the floor plan.
- **This is wrong for production and is marked as such wherever it appears.** A deal is confirmed when it is signed, not when an application is accepted. A real deployment should decouple them. Recorded as KI-03.
- Honest framing mattered more than hiding it: the alternative was a demo that silently dead-ends.

---

<a id="adr-008"></a>
## ADR-008: Parse the CV in the browser, upload nothing

**Status** Accepted · **Date** 22/09/2026

### Context

S4 imports a job seeker's profile from a LinkedIn PDF export. The mock API has
nowhere to put a file.

### Decision

Parse with pdf.js in the browser. The file never leaves the device — no upload,
no storage, no transmission.

### Options considered

| Option | Pros | Cons |
|---|---|---|
| Upload and parse server-side | Better parsing; reusable | No server; and a CV on a server is a retention and breach liability |
| Third-party parsing API | Best accuracy | Sends someone's CV to a third party — the worst available privacy position |
| **Browser-side pdf.js** | Nothing transmitted; strongest true privacy claim | Parsing is heuristic; 432 kB lazy chunk |

### Consequences

- "Your CV never leaves your device" is true, not marketing — which matters under PDPA 2010.
- pdf.js 6 has no `eval` or `new Function` left, so CSP `script-src 'self'` holds without an unsafe directive.
- A parse never saves silently; it prefills a form the person confirms. Résumé parsing is wrong often enough that silent commits would put errors in front of employers under the candidate's name.
- **Two parser defects found only by running real-shaped input:** LinkedIn's two-column layout welded a sidebar skill to a body heading, producing the skill "SQL Summary" — fixed by breaking a text baseline on horizontal gaps. And a contact line was taken as the headline.
- **Cost, and it is real:** this has never been run against a genuine LinkedIn export. See KI-06.

---

<a id="adr-009"></a>
## ADR-009: Redact personal fields at the recording layer, not the view

**Status** Accepted · **Date** 22/09/2026

### Context

The audit log records field-level changes as `from → to`. Applied to a name,
email or phone number, that makes the log a second store of exactly the
personal data the masking rules exist to contain — and it would then need its
own retention rule and its own breach surface.

### Decision

For `fullName`, `email`, `phone`, `contactName`, `contactEmail` and
`contactPhone`, record only *that* the field changed. `from` and `to` are null
and were never written.

### Consequences

- A component cannot leak what was never written. This is not a display choice the view could undo.
- The log needs no retention rule of its own, because it holds no personal data.
- The entity label is not redacted — an employer's *company* name is not personal data, and a log that cannot say which record changed is not a log. `contactName` is redacted; `name` is not.
- Verified by mutation: removing a field from the redaction set fails the test written for it.

---

<a id="adr-010"></a>
## ADR-010: A projection type, not masking, for employer data shown to job seekers

**Status** Accepted · **Date** 23/09/2026

### Context

J1 needed to show job seekers which employers are attending a fair. The obvious
implementation — `GET /employers?fair_id=X` — returns the full record: pipeline
stage, deal value, contact email and phone, lost reason, internal notes. The
project already had a masking precedent in `maskForViewer` for candidates.

### Decision

Return a separate `FairExhibitor` type with no commercial fields in it at all.
Separately, gate `GET /employers` and `/employers/{id}` to staff.

### Options considered

| Option | Pros | Cons |
|---|---|---|
| `maskEmployerForViewer` | Consistent with the candidate precedent; one type | The blanked fields still exist on the object a component holds; nothing stops a later template printing one |
| **`FairExhibitor` projection** | There is no field to print; the guarantee is structural | A second type where candidates needed only one |

### Consequences

- The guarantee does not depend on anyone remembering a rule.
- The gate is a *separate* mechanism because the two fail differently: the projection stops a future template leaking something; the gate stops someone reading the endpoint directly.
- Tested at the wire level in snake_case, not just camelCase, because that is what actually crosses the boundary.
- **This ADR exists because the hole was real.** `GET /employers` had no role check at all until J1 — any role could have read the entire sales pipeline.

### When to use which

Masking when the same consumer sometimes may and sometimes may not see the
values (an employer sees a candidate's email once shortlisted). Projection when
a consumer must never see them.

---

<a id="adr-011"></a>
## ADR-011: "Attending" means holding a booth

**Status** Accepted · **Date** 23/09/2026

### Context

Two candidate definitions existed. `Employer.fairIds` is the tag the pipeline
uses; a booth assignment is what the floor plan uses. They disagree, because
`fairIds` includes leads who were never accepted.

### Decision

For anything a job seeker sees, attending means holding a booth at that fair.

### Consequences

- A seeker is never shown a company that is not coming.
- It matches what the rest of the app already means: the fair card counts `boothAssigned` as "employers attending".
- A booth carries a code, which is the thing a visitor actually uses on the day.
- **Cost:** an employer approved but not yet seated does not appear until a booth is assigned. Acceptable — an exhibitor with no stand has nowhere for a visitor to go.
- Verified: at fair-01, 26 booths, 26 distinct employers, `boothAssigned` 26. The three views agree.

---

<a id="adr-012"></a>
## ADR-012: Signal stores rather than a state management library

**Status** Accepted · **Date** 21/09/2026

### Context

Thirteen feature areas need shared, reactive state.

### Decision

Plain injectable classes holding Angular signals. Private writable signals,
public `.asReadonly()`, `computed()` for derivations. No NgRx, no third-party
store.

### Options considered

| Option | Pros | Cons |
|---|---|---|
| NgRx | Devtools; established patterns; time-travel | Substantial boilerplate and bundle for an app this size; actions/reducers/effects for what is mostly "fetch and hold" |
| NgRx SignalStore | Lighter; signal-native | Still a dependency; the project's own rule is not to add one without need |
| **Plain signal stores** | No dependency; zero bundle cost; reads naturally in a zoneless app | Conventions must be held by discipline rather than by a library's shape |

### Consequences

- No bundle cost and no new vocabulary.
- The discipline held because the shape is simple enough to repeat: writable-private/readonly-public, `isLoading`/`hasError` computed, errors never swallowed.
- Converting observables to signals at the store boundary means nothing in `features/` subscribes, so no component manages a subscription lifecycle.
- **Cost:** no devtools and no time-travel debugging. Not felt at this size; would be at ten times the state.

---

## Superseded or revised in flight

Recorded because a decision that was reversed is more informative than one that
was not.

| Decision | Reversed by | Why |
|---|---|---|
| Skills as chips in the talent-pool table | Truncated text (docs/07 UX-3) | Measured: chips wrapped to a second row, took rows to 96px, and left ~70px of text each so they read "M…" and "Signal…" |
| Candidate profile as a side drawer | Modal on a child route (docs/10) | The drawer took half the row; as a flex child it cost the table 24px even when rendering nothing |
| Column widths tuned for the drawer | Rebalanced (docs/10 finding 6) | The drawer no longer exists, but Skills was still budgeted against ~600px |
| Server-side filtering for the Jobs tab | Client-side over one loaded list | "Matches my skills" cannot be a server filter — the server has no notion of whose skills — and filtering a server page again on the client reports the page's count, not the fair's |
