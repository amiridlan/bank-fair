# Software Requirements Specification — BankFair

## Document Control

| Field | Value |
|---|---|
| Project Name | BankFair |
| Document ID | SRS-001 |
| Version | 1.0 |
| Author | Amir Idlan |
| Date | 25/09/2026 |
| Status | Approved (retrospective) |

> **Retrospective.** These requirements were derived from the working system on
> 25/09/2026, not written before it. Each one describes behaviour that exists
> and is verified — the Verified-by column names the test that would fail if
> the requirement stopped holding. Where a requirement is only partly met, or
> met in a way a production system should not copy, it says so.

---

## 1. Introduction

### 1.1 Purpose

This document specifies what BankFair does, for developers maintaining it and
for whoever implements the Laravel backend that replaces the mock API. It is
the contract that backend must honour.

### 1.2 Scope

BankFair is a single-page web application serving three roles — career fair
organiser staff, exhibiting employers, and job seekers. It covers fair setup,
booth allocation, employer sales pipeline, employer applications to attend,
candidate sourcing, interview scheduling, job-seeker registration and profile
management, and an audit trail of every write.

It does not cover authentication, payment, notification delivery, or
persistence beyond the browser session. See §2.5.

### 1.3 References

| Ref | Document |
|---|---|
| PC-001 | `docs/sdlc/01-project-charter.md` |
| SDD-001 | `docs/sdlc/03-software-design-document.md` |
| ADR-001…012 | `docs/sdlc/04-architecture-decision-records.md` |
| TR-001 | `docs/sdlc/06-test-report.md` |
| — | `docs/01`–`docs/11`, the plans written during the build |
| — | Personal Data Protection Act 2010 (Malaysia) |
| — | WCAG 2.2 Level AA |

### 1.4 Definitions

| Term | Definition |
|---|---|
| Fair | A career fair event, with dates, a venue and a fixed grid of booths |
| Booth | One of 40 numbered stands at a fair (`A-01`…`E-08`), assignable to one employer |
| Exhibitor | An employer holding a booth at a given fair — the only definition of "attending" the system uses |
| Pipeline stage | Where an employer sits commercially: Lead → Proposal → Confirmed → Paid, or Lost |
| Application | An employer's request to attend a fair, subject to staff decision |
| Registration | A job seeker signing up for a fair, instant, with recorded consent |
| Shortlist | An employer's saved interest in a candidate, which unlocks that candidate's contact details |
| Job opening | A role an employer is recruiting for, advertised at the fairs they attend |
| Masking | Replacing a candidate's email with `a***@example.com` and suppressing the phone, server-side |

---

## 2. Overall Description

### 2.1 Product perspective

Standalone frontend, currently self-contained. The mock API is an Angular HTTP
interceptor serving an in-memory database; it is designed to be deleted and
replaced by a Laravel 12 + PostgreSQL API without changes to feature code
(ADR-001).

### 2.2 Product functions

Fair management · booth allocation · employer pipeline · application review ·
candidate search · shortlisting · interview booking · job-seeker registration ·
profile self-service and PDF import · job listings · audit logging.

### 2.3 User classes

| Class | Route prefix | Description |
|---|---|---|
| Staff | `/staff/*` | Organiser team. Sees every fair, every employer, the pipeline and the audit log. |
| Employer | `/hiring/*` | An exhibiting company's representative. Scoped to their own employer record. |
| Job seeker | `/me/*` | A candidate. Owns exactly one candidate record — their own. |

### 2.4 Operating environment

| Item | Value |
|---|---|
| Client | Modern evergreen browsers; Chromium, Firefox, Safari, Edge |
| Viewport range | 390px to 1440px+ verified; layout has no horizontal scroll at either end |
| Runtime | Angular 22, zoneless change detection |
| Build/Host | Angular CLI production build, static hosting (Netlify) |
| Locale | `en-MY`; dates `dd/MM/yyyy`, times `h:mm a`, currency `RM`, timezone `+08:00` |
| Backend | None — in-memory mock. Target: Laravel 12 + PostgreSQL 16 |

### 2.5 Constraints

| ID | Constraint |
|---|---|
| C-01 | No server. All state is in the browser and resets on reload. |
| C-02 | No real authentication. Identity is a demo switcher (ADR-003). |
| C-03 | No file upload. PDF import parses locally and transmits nothing (ADR-008). |
| C-04 | Initial bundle budget 650 kB; currently 640.69 kB. |
| C-05 | All demo data fictional. Real universities, cities and venues used as public places; no real person or company. |
| C-06 | No sensitive personal data collected — race, religion, health, disability (PDPA 2010). |

---

## 3. Functional Requirements

Priority is MoSCoW. Verified-by names the spec file holding the test.

### 3.1 Identity and access

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-01 | The system shall present four demo identities — one staff, two employer, one job seeker — switchable without credentials. | Must | `app.component.spec.ts` |
| FR-02 | The system shall restrict each role to its own route tree, redirecting any other role to its own home. | Must | `role.guard.spec.ts` |
| FR-03 | The role guard shall use `canMatch`, so a role's feature bundle is never downloaded by a role that cannot reach it. | Should | `role.guard.spec.ts` |
| FR-04 | The chosen identity shall survive a page reload within the same tab, and not beyond it. | Should | `auth.store` via `app.component.spec.ts` |
| FR-05 | The system shall refuse `GET /employers` and `GET /employers/{id}` to any role but staff, answering 404 rather than 403. | Must | `handlers.spec.ts` |
| FR-06 | The system shall refuse `GET /audit-entries` to any role but staff, answering 404. | Must | `handlers.spec.ts` |

> **FR-01 is demo-only and must not survive to production.** It is marked as
> such in the code. Laravel Sanctum replaces it; see ADR-003 and KI-01.

### 3.2 Fair management (staff)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-10 | The system shall list all fairs, filterable by status and city, with the filter state carried in the URL. | Must | `fairs.store.spec.ts` |
| FR-11 | The system shall group fairs as Current (live and upcoming, live first), Past (ended but not closed out) and Complete. | Must | `fairs.store.spec.ts` |
| FR-12 | A fair shall be considered ended when its status is `completed` **or** its end date has passed, whichever comes first. | Must | `fairs.store.spec.ts` |
| FR-13 | The fair detail shall present Overview, Floor plan and Employers as separate routes, each linkable and refreshable. | Must | `fair-overview-tab.component.spec.ts`, `fair-employers-tab.component.spec.ts` |
| FR-14 | The Overview shall show booth fill and check-in rate as progress bars carrying accessible values, the fair's pending applications with inline approve/turn-down, and the decisions already taken. | Should | `fair-overview-tab.component.spec.ts` |
| FR-15 | The check-in meter shall appear only once the fair has started. | Could | `fair-overview-tab.component.spec.ts` |

### 3.3 Booth allocation (staff)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-20 | The system shall render 40 booths per fair as a 5×8 grid, ordered by position, labelled row-letter + column-number. | Must | `handlers.spec.ts`, `floor-plan.store.spec.ts` |
| FR-21 | The system shall allow an unassigned employer to be assigned to a booth by drag-and-drop or by an explicit action. | Must | `floor-plan.store.spec.ts` |
| FR-22 | The system shall only offer employers at stage `confirmed` or `paid` for assignment. | Must | `floor-plan.store.spec.ts` |
| FR-23 | Assigning to an occupied booth shall require confirmation before replacing the occupant. | Must | `floor-plan.store.spec.ts` |
| FR-24 | A successful assignment shall offer an undo. | Should | `floor-plan.store.spec.ts` |
| FR-25 | The API shall answer 409 when a booth is taken, and the UI shall surface that as a conflict rather than a generic failure. | Must | `error-chain.spec.ts` |

### 3.4 Employer pipeline (staff)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-30 | The system shall present employers on a board with columns Lead, Proposal, Confirmed, Paid, Lost. | Must | `employers.store.spec.ts` |
| FR-31 | Each column shall show its committed value; Lost shall contribute nothing to any total. | Must | `employers.store.spec.ts`, `fair-employers-tab.component.spec.ts` |
| FR-32 | Moving an employer to Lost shall require a reason. | Must | `employers.store.spec.ts` |
| FR-33 | Moving an employer to Paid shall require a booth package, opening the edit form when one is absent. | Must | `employers.store.spec.ts` |
| FR-34 | The system shall validate employer records server-side and surface 422 errors against the originating field. | Must | `employers.store.spec.ts`, `api-error.spec.ts` |

> **FR-30 has no transition table.** Any stage may move to any other, including
> `paid → lead`. See KI-02.

### 3.5 Applications to attend (employer → staff)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-40 | An employer shall be able to apply to attend any fair open for signup. | Must | `handlers.spec.ts` |
| FR-41 | The system shall reject a duplicate application with 409 and resynchronise rather than reporting a failure. | Must | `handlers.spec.ts` |
| FR-42 | Staff shall be able to approve or turn down an application, with pending shown first and by default. | Must | `handlers.spec.ts` |
| FR-43 | A rejection shall require a reason, enforced by the API with 422 regardless of the UI, trimmed server-side. | Must | `handlers.spec.ts` |
| FR-44 | The rejection reason shall be shown to the employer who received it. | Must | `handlers.spec.ts` |
| FR-45 | Approval shall set the employer's pipeline stage to `confirmed`, making them assignable to a booth. | Must | `handlers.spec.ts` |
| FR-46 | An application's full detail shall be reachable at its own URL and survive a refresh. | Should | `applications` route spec |
| FR-47 | A second staff member deciding the same application shall receive 409, and the first decision shall stand. | Must | `handlers.spec.ts` |

> **FR-45 is a demo simplification.** A real deployment should decouple these:
> a deal is confirmed when it is signed, not when an application is accepted.
> Recorded as ADR-007 and KI-03.

### 3.6 Talent pool and shortlisting (employer)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-50 | The system shall list candidates with filters for university, field, graduation year and minimum CGPA, plus free-text search, sortable and paginated. | Must | `talent-pool.store.spec.ts` |
| FR-51 | The system shall mask candidate email and suppress phone **server-side** until that candidate is on the viewer's shortlist. | Must | `handlers.spec.ts`, `mask-email.pipe.spec.ts` |
| FR-52 | A job seeker viewing their own record shall see it unmasked. | Must | `handlers.spec.ts` |
| FR-53 | Shortlisting shall be possible from the row and from the profile, with an optional note. | Should | `shortlist.store.spec.ts` |
| FR-54 | Removing a shortlist entry shall re-mask that candidate's contact details. | Must | `shortlist.store.spec.ts` |
| FR-55 | A candidate profile shall be reachable at its own URL as a modal over the list. | Should | `talent-pool.store.spec.ts` |

| FR-56 | The system shall show an employer only candidates registered for a fair that employer is attending — tagged to it **and** at stage `confirmed` or `paid`. | Must | `handlers.spec.ts` |
| FR-57 | The system shall answer 404, not a masked record, for a candidate the viewer may not see. | Must | `handlers.spec.ts` |
| FR-58 | A job seeker shall see their own record and no other candidate. | Must | `handlers.spec.ts` |
| FR-59 | Staff shall see every registrant, with contact details masked. | Must | `handlers.spec.ts` |

> **FR-56 to FR-59 were added on 25/09/2026 (V1).** Before that the talent
> pool had no fair scoping at all and `getCandidate` had no visibility check —
> a candidate registered for nothing still appeared to every employer. That was
> KI-04, and it is now closed.

### 3.7 Interviews (employer)

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-60 | The system shall generate twenty-minute slots across each day of the active fair. | Must | `interviews.store.spec.ts` |
| FR-61 | A slot shall be bookable only for a candidate already on the viewer's shortlist. | Must | `interviews.store.spec.ts` |
| FR-62 | Booking an already-booked slot shall answer 409. | Must | `handlers.spec.ts` |
| FR-63 | A booking shall be cancellable, returning the slot to open. | Must | `interviews.store.spec.ts` |

### 3.8 Job-seeker self-service

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-70 | A job seeker shall be able to register for any fair open for signup, instantly, without review. | Must | `handlers.spec.ts` |
| FR-71 | Registration shall require explicit consent, collected before the request and recorded with a timestamp. | Must | `handlers.spec.ts` |
| FR-72 | The system shall show when consent was given, not merely that registration exists. | Should | `seeker-fair-details-tab.component.spec.ts` |
| FR-73 | Withdrawal shall be confirmed first, and shall remove the seeker's profile from that fair's employers. | Must | `handlers.spec.ts` |
| FR-74 | Registration shall not be offered for a fair whose dates have passed, whatever its status still says. | Must | `seeker-fair-details-tab.component.spec.ts` |
| FR-75 | A job seeker shall be able to edit their own profile, and only their own; the API shall answer 404 to anyone else. | Must | `handlers.spec.ts` |
| FR-76 | The system shall import a profile from a LinkedIn PDF export parsed entirely in the browser, with nothing transmitted or stored. | Should | `profile-import.service.spec.ts`, `profile-parser.spec.ts` |
| FR-77 | An import shall never save silently; it shall prefill a form the person confirms. | Must | `profile-import.service.spec.ts` |

### 3.9 Fair detail for job seekers

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-80 | A job seeker shall see, per fair, the roles being recruited for, the employers attending, and the fair's own details — each its own route. | Must | `seeker-fair-detail-page.component.spec.ts` |
| FR-81 | "Attending" shall mean holding a booth at that fair, not appearing in the employer's `fairIds`. | Must | `handlers.spec.ts` |
| FR-82 | The employer list shown to a job seeker shall carry **no commercial field** — no stage, deal value, contact details, lost reason or internal notes — in any casing, at the wire level. | Must | `handlers.spec.ts` (two tests, handler and engine level) |
| FR-83 | Job openings shall be filterable by field, employment type, experience level and free text. | Must | `seeker-fair-jobs-tab.component.spec.ts` |
| FR-84 | A salary range shall be shown when disclosed, and its absence stated explicitly rather than left blank. | Should | `seeker-fair-jobs-tab.component.spec.ts` |
| FR-85 | Roles overlapping the viewer's own profile skills shall be marked, and filterable, with the marker carried by text as well as colour. | Should | `seeker-fair-jobs-tab.component.spec.ts` |
| FR-86 | The skill-match control shall be hidden, with an explanation, when the profile carries no skills. | Should | `seeker-fair-jobs-tab.component.spec.ts` |

### 3.10 Audit trail

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-90 | The system shall record every non-GET request that succeeds, with actor, action, entity, label and changed fields. | Must | `handlers.spec.ts` |
| FR-91 | Every write route shall carry an audit descriptor; a route without one shall fail the build's test suite. | Must | `handlers.spec.ts` (asserts over the route table) |
| FR-92 | Personal fields — name, email, phone, contact name/email/phone — shall record **that** they changed and never their values. | Must | `handlers.spec.ts` |
| FR-93 | Reads shall not be logged. | Must | `handlers.spec.ts` |
| FR-94 | The log shall be readable by staff only, and capped at 200 entries. | Must | `handlers.spec.ts` |
| FR-95 | The log shall be filterable by entity and by action. | Should | `audit.store.spec.ts` |

### 3.11 Dashboard

| ID | Requirement | Priority | Verified by |
|---|---|---|---|
| FR-100 | The system shall present four KPIs — active fairs, booth fill rate, registrations, pipeline value — with direction-of-change carried by an arrow as well as colour. | Must | `dashboard.store.spec.ts`, `kpi-card.component.spec.ts` |
| FR-101 | "Active fairs" shall exclude fairs whose dates have passed. | Must | `dashboard.store.spec.ts` |
| FR-102 | Charts shall load only when scrolled into view. | Should | `dashboard` route |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Status |
|---|---|---|
| NFR-01 | Initial bundle shall not exceed 650 kB raw. | Met — 640.69 kB |
| NFR-02 | Every feature area shall be lazy-loaded; no feature code in the initial bundle. | Met — `loadChildren` throughout |
| NFR-03 | Lists exceeding ~100 rows shall be paginated server-side. | Met — candidates, job openings, audit entries |
| NFR-04 | Simulated API latency of 300–800ms shall be applied so loading states are exercised rather than theoretical. | Met — `mock-api.interceptor.ts` |

### 4.2 Security and privacy

| ID | Requirement | Status |
|---|---|---|
| NFR-10 | No secrets, API keys or tokens shall appear in frontend code or environment files. | Met |
| NFR-11 | `innerHTML` with user-supplied data and `bypassSecurityTrust*` shall not be used. | Met — neither appears in the codebase |
| NFR-12 | Content-Security-Policy shall specify `script-src 'self'`. | Met — `netlify.toml` |
| NFR-13 | Authorisation refusals shall answer 404, never 403, so a refusal does not confirm a record exists. | Met |
| NFR-14 | Contact masking shall be enforced at the API, not in templates. | Met |
| NFR-15 | Sensitive categories — race, religion, health, disability — shall never be collected or displayed (PDPA 2010). | Met |
| NFR-16 | Consent shall be recorded with a timestamp against a stated purpose (PDPA 2010). | Met — `FairRegistration.consentedAt` |
| NFR-17 | A CV uploaded for import shall not be transmitted or stored. | Met — parsed in the browser, nothing leaves the device |

### 4.3 Accessibility

| ID | Requirement | Status |
|---|---|---|
| NFR-20 | Conformance to WCAG 2.2 Level AA on all surfaces. | Met — axe-core clean at 1440px and 390px on audited surfaces |
| NFR-21 | No status shall be carried by colour alone; every state shall have an icon or text. | Met — `status-chip.component.spec.ts` |
| NFR-22 | Every interactive element shall be keyboard-reachable with a visible focus state. | Met |
| NFR-23 | Touch targets shall be at least 44×44px on coarse pointers. | Met |
| NFR-24 | Scrollable regions shall be keyboard-focusable. | Met |
| NFR-25 | State changes without a visual cue shall be announced to assistive technology. | Met — `LiveAnnouncer` on shortlisting, registration, decisions |
| NFR-26 | Layout shall not scroll horizontally at 390px. | Met |
| NFR-27 | Motion shall respect `prefers-reduced-motion`. | Met |

### 4.4 Maintainability

| ID | Requirement | Status |
|---|---|---|
| NFR-30 | TypeScript strict mode; `any` shall not appear. | Met |
| NFR-31 | Modern Angular only — standalone components, signals, built-in control flow, `inject()`, OnPush. | Met |
| NFR-32 | Lint shall pass with zero warnings. | Met |
| NFR-33 | Every store method calling the API shall handle errors and expose an error signal. | Met |
| NFR-34 | Every data view shall implement loading, empty, error-with-retry and loaded. | Met |
| NFR-35 | Design tokens shall be the single source of visual values; no hard-coded hex or magic pixel numbers in components. | Met — enforced structurally by removing Tailwind's default palette (ADR-004) |

### 4.5 Reliability

| ID | Requirement | Status |
|---|---|---|
| NFR-40 | An error shall arrive as a real `HttpErrorResponse` so the error interceptor and every store's error path are genuinely exercised. | Met |
| NFR-41 | A simulated-failure mode shall be available to demonstrate error handling, exempting the reset endpoint. | Met |
| NFR-42 | The demo shall render identically on every load from a fixed seed. | Met |

---

## 5. Interface Requirements

### 5.1 API — the contract Laravel must honour

Wire format is snake_case both directions; the client converts at the boundary.
Collections return `{ data, meta }`; single resources return `{ data }`.

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/dashboard/summary` | GET | Staff | KPIs and chart series |
| `/audit-entries` | GET | **Staff only** | Filters: `actor_id`, `entity`, `action`. 404 to others |
| `/fairs` | GET | Any | Filters: `status`, `city` |
| `/fairs/{id}` | GET | Any | |
| `/fairs/{id}/booths` | GET | Any | Ordered by grid position |
| `/fairs/{id}/exhibitors` | GET | Any | Seeker-safe projection; no commercial fields |
| `/fairs/{id}/job-openings` | GET | Any | Paginated. Filters: `function`, `type`, `level`, `employer_id`, `search` |
| `/booths/{id}` | PATCH | Staff | 409 when occupied |
| `/employers` | GET | **Staff only** | Filters: `stage`, `fair_id`, `search`. 404 to others |
| `/employers/{id}` | GET | **Staff only** | 404 to others |
| `/employers` | POST | Staff | 422 on validation failure |
| `/employers/{id}` | PATCH | Staff | 422 on validation failure |
| `/candidates` | GET | Staff, Employer | Paginated, filtered, sorted. Contact masked per viewer |
| `/candidates/{id}` | GET | Staff, Employer, Owner | Contact masked per viewer |
| `/candidates/{id}` | PATCH | **Owner only** | 404 to everyone else |
| `/shortlists` | GET / POST | Employer | 409 on duplicate |
| `/shortlists/{id}` | DELETE | Employer | Re-masks the candidate |
| `/fair-applications` | GET / POST | Employer, Staff | 409 on duplicate |
| `/fair-applications/{id}` | PATCH | Staff | 422 without a rejection reason; 409 if already decided |
| `/fair-registrations` | GET / POST | Job seeker | 409 on duplicate; consent required |
| `/fair-registrations/{id}` | DELETE | Job seeker | |
| `/interview-slots` | GET | Employer | |
| `/interview-slots/{id}` | PATCH | Employer | 409 when taken |
| `/demo/reset` | POST | Any | Demo control; exempt from simulated failures |

**Error envelope.** 422 follows Laravel's shape exactly:

```json
{ "message": "The given data was invalid.",
  "errors": { "contact_email": ["The contact email must be a valid email address."] } }
```

Other errors carry `{ "message": "..." }`. The client maps these to an
`ApiError` type; 422 attaches to form controls, everything else raises a
snackbar.

### 5.2 User interfaces

Specified in `docs/03-design-system.md` (tokens, type scale, components) and
`docs/02-ux-flows.md` (flows per role). Reviewed in `docs/10-ui-ux-review.md`.

### 5.3 External interfaces

| System | Purpose | Notes |
|---|---|---|
| pdf.js 6 | Parse a LinkedIn PDF export in the browser | Module worker; requires a JavaScript MIME type from the host. No network use |
| Google Fonts | Plus Jakarta Sans, IBM Plex Sans/Mono, Material Symbols | The only third-party origin the app contacts |

---

## 6. Data Requirements

### 6.1 Entities

| Entity | Key attributes | Sensitivity |
|---|---|---|
| `Fair` | id, name, venue, city, description, startDate, endDate, status, boothTotal, boothAssigned, registrations, checkIns | Public |
| `Booth` | id, fairId, code, row, col, package, priceMyr, employerId, employerName | Internal |
| `Employer` | id, name, industry, companySize, **stage**, lostReason, **contactName/Email/Phone**, boothPackage, **dealValueMyr**, fairIds, **notes** | **Commercial + PII** |
| `FairExhibitor` | employerId, name, industry, companySize, boothCode, openingCount | Public — projection of `Employer` with every bold field above removed |
| `Candidate` | id, fullName, university, fieldOfStudy, qualification, graduationYear, cgpa, skills, headline, **email**, **phone**, isContactVisible, fairIds | **PII** |
| `JobOpening` | id, employerId, fairIds, title, jobFunction, employmentType, experienceLevel, location, skills, salaryMin/MaxMyr, headcount, postedAt | Public |
| `Shortlist` | id, employerId, candidateId, fairId, note, createdAt | Internal |
| `InterviewSlot` | id, fairId, employerId, startTime, endTime, candidateId, candidateName | Internal |
| `FairApplication` | id, fairId, employerId, employerName, status, appliedAt, decidedAt, rejectionReason | Internal |
| `FairRegistration` | id, fairId, candidateId, registeredAt, **consentedAt** | Consent record |
| `AuditEntry` | id, at, actorId, actorName, actorRole, action, entity, entityId, entityLabel, method, path, changes | Internal |
| `User` | id, name, role, employerId, candidateId | Demo only |

### 6.2 Retention and deletion

| Rule | Current state | Production requirement |
|---|---|---|
| Consent is recorded as a row with a timestamp, not a boolean, so it can be shown to have been given for a stated purpose at a point in time | Met | Keep |
| Withdrawal deletes the registration and re-hides the profile from that fair's employers | Met | Keep |
| The audit log never stores personal values, so it needs no retention rule of its own | Met | Keep — this is deliberate (ADR-009) |
| Audit log capped at 200 entries, in memory, cleared by reload | Demo behaviour | Replace with a server-side append-only table and a stated retention period |
| Right to erasure (PDPA s.k) | **Not implemented** | Required before any real personal data — see KI-05 |

---

## 7. Traceability Matrix

Charter objective → requirements → verifying tests.

| Objective | Requirements | Verified by |
|---|---|---|
| OBJ-01 Three roles with enforced boundaries | FR-01…06 | `role.guard.spec.ts` (13), `handlers.spec.ts` gate tests (6) |
| OBJ-02 Backend-swappable | §5.1 contract, NFR-40 | `api.service.spec.ts` (6), `case-conversion.spec.ts` (9), `error-chain.spec.ts` (3) |
| OBJ-03 Four states everywhere | NFR-34 | Store specs across all 13 stores |
| OBJ-04 WCAG 2.2 AA | NFR-20…27 | axe-core runs per surface; `status-chip.component.spec.ts` (5) |
| OBJ-05 Load-bearing tests | — | 401 tests, mutation-checked on the guarantees in FR-82, FR-92, FR-81, FR-85 |
| OBJ-06 Bundle budget | NFR-01, NFR-02 | Build output |
| OBJ-07 Deployable demo | FR-01 | Netlify deploy |

### Requirements without direct automated coverage

Stated rather than hidden:

| Requirement | Why, and how it is verified instead |
|---|---|
| FR-102 (defer charts) | Verified by build output — the chart chunk is separate — and by observation |
| NFR-04 (latency) | Configuration, not behaviour |
| NFR-12 (CSP) | Host configuration, verified by inspecting response headers |
| NFR-22, NFR-26 (focus, no h-scroll) | Verified by axe-core and by scripted viewport measurement, not by unit tests |
| FR-76 (PDF import) | Unit-tested against synthetic PDFs. **Never run against a genuine LinkedIn export** — see KI-06 |

---

## 8. Approval

Retrospective; see PC-001 §10. Approved by the project owner as the system it
describes was built.
