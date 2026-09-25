# Project Charter — BankFair

## Document Control

| Field | Value |
|---|---|
| Project Name | BankFair (working name *FairOps*) |
| Document ID | PC-001 |
| Version | 1.0 |
| Author | Amir Idlan — developer and project owner |
| Date | 25/09/2026 |
| Status | Approved (retrospective) |
| Approver(s) | Amir Idlan (sole stakeholder) |

> **This charter is retrospective.** It was written on 25/09/2026, after the
> system described in it was built. It records what the project set out to do
> and what it actually delivered, in charter form, so the SDLC set has a
> defensible starting point. It does not pretend to have authorised work that
> had already happened.
>
> Sections that a real charter carries but this project genuinely does not have
> — budget, funding approval, a stakeholder register, sponsor sign-off — are
> marked **N/A** with the reason, rather than filled with plausible numbers.
> Anything in this document can be checked against the repository.

---

## 1. Project Overview

BankFair is a career fair operations portal. A career fair has three parties
whose work is normally spread across spreadsheets, email threads and a printed
floor plan: the organising team who sell booths and run the event, the
employers who buy a booth and want to meet candidates, and the job seekers who
turn up hoping to find work. BankFair puts all three in one system.

It was built as a **portfolio demonstration**, not as a product with customers.
That constraint shapes every technical decision in it: the application is
frontend-only, and every request is served by an in-memory mock HTTP API that
resets when the page reloads. The mock is not a stub bolted on for convenience
— it is an HTTP interceptor that speaks the exact request and response shapes a
Laravel 12 API will expose, so that replacing it later is a configuration
change rather than a rewrite of the features.

The project ran from **21/09/2026 to 23/09/2026** across 124 commits, developed
entirely in cloud sessions using Claude Code on the web, with no local machine
setup. It is complete and deployed.

---

## 2. Business Case

**Problem statement.** Career fair operations are coordination-heavy and
mostly manual. An organiser tracks booth sales in one place, the floor plan in
another, and employer applications in email. Employers get a candidate list
after the event, when the people they wanted to meet have already gone
elsewhere. Job seekers arrive knowing the fair's name and little else — not who
is exhibiting, and certainly not what roles are open.

**Proposed solution.** A single portal with three role-scoped views: staff
manage fairs, booths and the employer sales pipeline; employers browse a talent
pool, shortlist candidates and book interview slots; job seekers register for
fairs, maintain a profile, and see what work is actually on offer before they
commit a day to attending.

**Expected benefits.** As a portfolio piece, the benefit is demonstrative
rather than commercial: it shows a non-trivial three-role application with real
authorisation boundaries, an audit trail, WCAG 2.2 AA accessibility, and an
API contract designed for a backend that does not exist yet. There is no
revenue model and no cost saving to claim, and inventing one would be
dishonest.

**Cost of inaction.** N/A — there is no operational process depending on this
system.

---

## 3. Objectives & Success Criteria

These were the project's actual targets, and the Actual column is measured from
the repository as of 25/09/2026.

| # | Objective | Measurable criterion | Target | Actual | Met |
|---|---|---|---|---|---|
| OBJ-01 | Three working roles with enforced boundaries | Roles with their own navigation, routes and guard | 3 | 3 (staff, employer, job seeker) | Yes |
| OBJ-02 | Backend-swappable architecture | Feature code containing no mock-specific logic | 0 references | 0 — the mock is an HTTP interceptor; features call `HttpClient` | Yes |
| OBJ-03 | Every data view handles all four states | Views with loading, empty, error-with-retry and loaded | 100% | 100% | Yes |
| OBJ-04 | Accessibility to WCAG 2.2 AA | axe-core violations on audited surfaces at 1440px and 390px | 0 | 0 | Yes |
| OBJ-05 | Test suite that is load-bearing | Passing automated tests | — | 401 across 31 spec files | Yes |
| OBJ-06 | Initial bundle within budget | Initial bundle size | < 650 kB | 640.69 kB | Yes |
| OBJ-07 | Deployable demo | Public URL, reachable without sign-in | 1 | Netlify deploy, four demo identities | Yes |

---

## 4. Scope

### In scope — delivered

| Area | Delivered |
|---|---|
| Staff — fairs | List with URL-backed filters; detail with Overview, Floor plan and Employers tabs; Current / Past / Complete grouping |
| Staff — floor plan | 40-booth grid per fair, drag-and-drop assignment, occupied-booth confirmation, undo |
| Staff — employer pipeline | Kanban board Lead → Proposal → Confirmed → Paid → Lost, with committed value per column and rules on stage moves |
| Staff — registrations | Employer application queue with approve / turn down, a required rejection reason, and a detail modal on its own URL |
| Staff — dashboard | Four KPIs and two charts, deferred until scrolled into view |
| Staff — activity log | Every write in the session, by whom, with changed fields; personal fields record only *that* they changed |
| Employer — talent pool | 300 seeded candidates, filterable and sortable, contact details masked until shortlisted |
| Employer — shortlist & interviews | Shortlisting with notes; twenty-minute interview slots per fair day |
| Employer — fair applications | Apply to attend; see the organiser's decision and its reason |
| Job seeker — fairs | Register with recorded consent; withdraw; per-fair detail with Roles, Employers and Details tabs |
| Job seeker — profile | Self-service edit, plus import from a LinkedIn PDF parsed entirely in the browser |
| Cross-cutting | Role switching, settings, demo reset, route progress, error interceptor, audit recording |

### Out of scope — deliberately not built

- **Real authentication.** Identity is a demo switcher backed by `sessionStorage`. Laravel Sanctum replaces it, and every auth-shaped call is already in the shape it will need.
- **A real backend and database.** The mock API is in memory and resets on reload.
- **File upload or storage.** The PDF import parses in the browser and uploads nothing, which is both the mock's limitation and the strongest available privacy position.
- **Payments.** Booth packages carry prices; nothing is charged.
- **Email or notification delivery.** Decisions surface in the UI only.
- **Multi-tenancy, localisation beyond `en-MY`, and dark mode.** Tokens allow dark later; it is not built.

---

## 5. Stakeholders

**N/A as a formal register.** This project had one participant, who was
sponsor, analyst, developer, tester and approver. A stakeholder register with
interest and influence ratings would be a table with one row and no decisions
in it.

| Name | Role | Responsibility |
|---|---|---|
| Amir Idlan | Project owner, sole developer | Every decision on this project |

The **intended audiences for the finished artefact** — distinct from
stakeholders in the work — are prospective employers and technical reviewers
reading the code, and any future team picking the project up.

---

## 6. Timeline — as it actually ran

Dates are taken from the commit history, not from a plan.

| Phase | Workstream | Date | Outcome |
|---|---|---|---|
| Setup | Scaffold, cloud tooling, environment | 21/09/2026 | Angular 22 + Material + charts + eslint |
| 0–7 | Original build: design system, fairs, floor plan, pipeline, talent pool, shortlist, interviews, dashboard | 21/09/2026 | Core application |
| T1–T5 | Tailwind v4 UI refresh and usability review | 21/09/2026 | Token system, layer discipline, contrast fixes |
| S1–S4 | Self-service roles and PDF profile import | 21–22/09/2026 | Third role, employer applications, browser-side CV parsing |
| A1–A3 | Loading feedback, Settings, audit log | 22/09/2026 | Operational visibility |
| — | README and architecture diagrams | 22/09/2026 | Four rendered Mermaid diagrams |
| — | UI/UX review and six targeted fixes | 23/09/2026 | docs/10 |
| J1–J3 | Job openings and the seeker fair detail | 23/09/2026 | Seeker-safe employer projection, jobs listing |
| — | SDLC documentation | 25/09/2026 | This set |

Elapsed calendar time was three days of development. Effort is not reported in
person-days because the work was done in AI-assisted sessions, and converting
that to a conventional figure would be a guess presented as a measurement.

---

## 7. Budget

**N/A.** No budget was allocated, no money was spent beyond free-tier hosting,
and no one was paid. The template's cost table is left empty deliberately: a
plausible-looking figure here would be the single most misleading thing in this
document set.

| Category | Cost |
|---|---|
| Development | N/A — no paid effort |
| Infrastructure | RM 0 — Netlify free tier, no backend |
| Licences | RM 0 — all dependencies MIT or equivalent |

---

## 8. Risks & Assumptions

### Risks that were live during the project, and what happened

| ID | Risk | Likelihood | Impact | Mitigation | Outcome |
|---|---|---|---|---|---|
| R-01 | Mock API shape diverges from what Laravel would expose, making the swap a rewrite | M | H | Every endpoint modelled on Laravel conventions: snake_case wire format, `{ data, meta }` envelopes, 422 validation shape, 404-not-403 for authorisation | Held. 27 routes all follow it |
| R-02 | Tailwind v4 and Angular Material fight over the cascade | H | M | Documented split ownership (ADR-002); Material owns its components, Tailwind owns app markup | Partially held — breached twice, both caught and fixed (docs/10) |
| R-03 | Personal data leaks through a view that was not thinking about it | M | H | Masking enforced server-side in the mock, not in templates; audit log redacts personal fields at the recording layer | Held for candidates. One real breach found and fixed in J1 (`GET /employers` was ungated) |
| R-04 | Accessibility regresses as features are added | M | M | axe-core run against every new surface at 1440px and 390px before each merge | Held |
| R-05 | Bundle grows past the budget | M | L | Measured before adopting anything; Material progress components rejected at 21.55 kB in favour of 1.77 kB of CSS (ADR-006) | Held — 640.69 kB against a 650 kB budget |
| R-06 | Cloud-only development blocks verification | H | M | Verification via production build, unit tests, and headless Chromium rather than a dev server | Held, with friction — see the assumption below |

### Assumptions

- **The developer cannot view `localhost`.** All sessions run in a cloud VM; the reviewer sees the app through a Netlify deploy preview. Verification is therefore build + test + headless browser, never "open it and look".
- **The demo data is fictional and must stay so.** No real people, companies, emails or phone numbers. Real Malaysian universities, cities and venues are used, as public places rather than parties.
- **PDPA 2010 applies to the data shapes even though no real data exists.** Consent is recorded with a timestamp; sensitive categories (race, religion, health, disability) are never collected.
- **A single seed produces an identical demo on every load,** so a walkthrough can be rehearsed and screenshots stay valid.

---

## 9. Methodology

**Hybrid**, and the choice is worth stating precisely because neither pure
label fits what happened.

Each workstream began with a written plan committed to `docs/` and approved
before any code was written — `docs/06` through `docs/11` are those plans, and
the commit history shows the plan landing before the implementation in every
case. That is Waterfall-shaped gating, and it was deliberate: the approval step
between phases is what stopped scope drifting.

Execution inside each phase was iterative. Decisions were revised mid-flight
when the code disagreed with the plan — the talent pool's skills column was
specified as chips, built as chips, measured at 96px rows, and reverted to
truncated text; the seeker fair detail's "employers attending" rule changed
from `fairIds` to booth-holding once `fairIds` was found to include leads who
never attended. Each reversal was recorded in the plan document rather than
quietly applied.

Two practices sit outside both methodologies and are worth naming as part of
the method, because they caught defects nothing else did:

- **Browser verification over test-passing.** Several real defects passed the entire suite and were found only by opening the page: a modal title indented 196px by a Material pseudo-element, an unreachable error state, a salary rendering as `RM3,500–4,700/ month`.
- **Mutation testing of new guarantees.** After writing a test for a rule, the rule was deliberately broken to confirm the test failed. Applied to the audit log's redaction, the employer projection, the fair-scoping filters and the skill match.

---

## 10. Approval

**N/A as a sign-off gate.** This charter documents completed work approved by
its only stakeholder as it was produced, phase by phase, in the conversation
history and the commit log. A signature block here would record a ceremony that
did not take place.

| Name | Role | Basis of approval | Date |
|---|---|---|---|
| Amir Idlan | Project owner | Approved each phase plan before implementation, and each phase's result on completion | 21–23/09/2026 |

---

## Related documents

| Document | Covers |
|---|---|
| `docs/sdlc/02-software-requirements-specification.md` | What the system does, traced to tests |
| `docs/sdlc/03-software-design-document.md` | How it is built |
| `docs/sdlc/04-architecture-decision-records.md` | Why the significant choices were made |
| `docs/sdlc/05-coding-standards.md` | The rules the code is held to |
| `docs/sdlc/06-test-report.md` | What is verified, and how |
| `docs/sdlc/07-known-issues-and-maintenance.md` | What is not done, and what would break |
| `docs/01`–`docs/11` | The working plans written during the build, which these documents cite rather than replace |
