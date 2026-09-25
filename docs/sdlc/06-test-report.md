# Test Report — BankFair

## Document Control

| Field | Value |
|---|---|
| Project Name | BankFair |
| Document ID | TR-001 |
| Version | 1.0 |
| Date | 25/09/2026 |
| Test cycle | Full suite, at project completion |
| Build under test | `a92ab28` on `claude/upbeat-brown-hgyfjm` |

> **What this report is and is not.** It reports the automated suite and the
> manual verification that was actually performed. There was **no independent
> QA function, no UAT with real users, and no defect tracker** — one person
> built and tested this. Those sections are marked N/A rather than filled with
> invented test cycles and sign-offs. Everything reported here can be
> reproduced by running the commands in §2.

---

## 1. Summary

| Metric | Value |
|---|---|
| Automated tests | **401** |
| Passing | **401 (100%)** |
| Failing | 0 |
| Skipped | 0 |
| Spec files | 31 |
| Suite runtime | ~23s |
| Lint | Clean, zero warnings |
| Production build | Succeeds, zero warnings |
| Initial bundle | 640.69 kB against a 650 kB budget |
| axe-core violations on audited surfaces | 0 at 1440px and 0 at 390px |

---

## 2. Reproducing this

```bash
npm ci                       # npm 10 cannot resolve this graph; ci is unaffected
npm test -- --watch=false    # 401 tests
npm run lint                 # zero warnings
npm run build                # bundle report
```

Accessibility and browser verification are not part of the suite; they were run
per surface with headless Chromium and axe-core. Method in §5.

---

## 3. Coverage by area

Counts are `it()` blocks per spec file.

### Mock API and core — 218 tests (54%)

| Spec | Tests | Covers |
|---|---|---|
| `handlers.spec.ts` | 131 | All 27 endpoints: filters, pagination, 404/409/422 paths, role gates, masking, audit recording |
| `mock-db.spec.ts` | 19 | Seed determinism and derived counts |
| `app.component.spec.ts` | 19 | Routing through the real shell, per role |
| `role.guard.spec.ts` | 13 | Role boundaries and redirects |
| `api-error.spec.ts` | 12 | Error mapping, including the Laravel 422 shape |
| `case-conversion.spec.ts` | 9 | snake_case ⇄ camelCase at the boundary |
| `side-nav.component.spec.ts` | 7 | Navigation per role |
| `api.service.spec.ts` | 6 | Envelope handling, pagination normalisation |
| `route-progress.component.spec.ts` | 3 | Progress on navigation events |
| `error-chain.spec.ts` | 3 | A 409 surfacing as a conflict through the real interceptor chain |

### Features — 149 tests (37%)

| Spec | Tests | Covers |
|---|---|---|
| `fairs.store.spec.ts` | 16 | Filters, URL state, Current/Past/Complete grouping |
| `employers.store.spec.ts` | 16 | Pipeline moves, stage rules, committed value |
| `profile-import.service.spec.ts` | 15 | PDF import orchestration; confirm-before-save |
| `floor-plan.store.spec.ts` | 14 | Assignment, occupied-booth conflict, undo |
| `profile-parser.spec.ts` | 13 | Column splitting, headline detection, field extraction |
| `interviews.store.spec.ts` | 13 | Slot generation, booking, cancellation |
| `shortlist.store.spec.ts` | 11 | Add, remove, re-masking on removal |
| `talent-pool.store.spec.ts` | 10 | Filters, sort, pagination |
| `seeker-fair-jobs-tab.component.spec.ts` | 8 | Job filters, salary display, skill matching |
| `settings-page.component.spec.ts` | 6 | Settings and demo controls |
| `dashboard.store.spec.ts` | 6 | KPI derivation, active-fair rule |
| `audit.store.spec.ts` | 5 | Filtering, the two independent slices |
| `seeker-fair-details-tab.component.spec.ts` | 5 | Registration state, consent display, closed fairs |
| `fair-overview-tab.component.spec.ts` | 5 | Fair-scoped queue and decisions, progress meters |
| `seeker-fair-detail.store.spec.ts` | 4 | Load, clear-on-error, no reach for `/employers` |
| `fair-employers-tab.component.spec.ts` | 4 | Fair-tagged employers, pipeline totals |
| `seeker-fair-detail-page.component.spec.ts` | 3 | Error state, staleness guard |

### Shared UI — 22 tests (5%)

`kpi-card` (8), `status-chip` (5), `mask-email` pipe (5), `busy-label` (4).

### Distribution

The mock API holding the largest share is deliberate. It is where the rules
live — authorisation, masking, validation, conflict handling and audit
recording are all enforced there, not in components. A rule tested at the
component level can be bypassed by another component; tested at the API it
cannot.

---

## 4. Guarantees verified by mutation testing

For rules where a passing test could be vacuous, the rule was deliberately
broken and the suite re-run to confirm the right test failed. This is the
evidence that these tests are load-bearing rather than decorative.

| Guarantee | Mutation applied | Result |
|---|---|---|
| Audit log redacts personal fields | Removed a field from the redaction set | Failed the redaction test |
| Audit log covers every write route | Removed a route's audit descriptor | Failed the route-table assertion |
| Exhibitor projection carries no commercial field | Spread the whole `Employer` into it | Failed both the handler and wire-level tests |
| Same, subtler | Added a single `notes` field | Failed both |
| `/employers` is staff-only | Removed the role check | Failed the gate tests |
| Fair Overview queue is fair-scoped | Dropped the `fairId` filter | Failed two tests |
| Recent decisions are fair-scoped | Dropped the application-id join | Failed one test |
| Skill match compares against the profile | Returned every skill as matched | Failed three tests |
| Registration respects fair timing, not status | Replaced `isOpenForSignup` with a status check | Failed the ended-but-open test |
| Error state is reachable | Restored skeleton-before-error ordering | Failed the error-state test |

Ten mutations, ten caught by the test written for them.

---

## 5. Manual and browser verification

Automated tests in jsdom cannot see layout, contrast or focus. Each surface was
additionally driven in headless Chromium at 1440×1000 and 390×844.

| Check | Method |
|---|---|
| Accessibility | axe-core with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` |
| Horizontal scroll | `scrollWidth > clientWidth` at 390px |
| Layout measurement | `getBoundingClientRect()` on specific elements |
| Flows end to end | Scripted interaction — register, shortlist, approve, assign |

### Defects found only this way

Every one of these passed the full suite.

| Defect | Detection |
|---|---|
| Dialog titles indented 196px by Material's `::before` interacting with `space-between` | Measured: content box at x=364, title at x=559.78 |
| The same, in miniature — a 12px `gap` applying to that pseudo-element | Measured after the first fix: x=376, not 364 |
| Close button dropped below the title when a global helper lost a specificity tie | Visual |
| Fair detail error state unreachable; a 404 sat on a skeleton for ever | Navigated to a bad id |
| Salary rendering as `RM3,500–4,700/ month` | Visual — Angular collapses template whitespace |
| Searching "intern" returning nothing while the Type filter held 19 | Interaction |
| Card actions misaligned across a grid row (y=367 vs y=397) | Measured |
| Fair Overview 68% empty — content ended at y=317 in a 1000px viewport | Measured |
| Talent pool shifting 24px when a profile opened | Measured |

### Three verifications of mine that were themselves wrong

Recorded because a false negative in a check is as dangerous as a bug, and each
of these nearly entered a report as a finding.

| Wrong result | Actual cause |
|---|---|
| "All roles get 200 from `/employers`" — apparently no gate | `fetch()` never reaches an Angular interceptor; the static server was returning `index.html` for every path |
| "No salary figures render at all" | The regex required whitespace the broken markup did not have — the check failed for the same reason the display was wrong |
| "Registering did not reach the list" (2 cards, not 3) | `page.goto` reloads the app, and the mock database is in memory, so it reseeded |

The lesson carried forward: **when a check reports something surprising, verify
the check before reporting the finding.**

---

## 6. Defect management

**N/A as a formal process.** No tracker, no severity SLA, no triage meeting.
Defects were found and fixed within the phase that introduced them, and
recorded in that phase's plan document (`docs/06`–`docs/11`) with the
measurement that found them.

Outstanding defects are in `docs/sdlc/07-known-issues-and-maintenance.md`.

---

## 7. Exit criteria

| Criterion | Met | Evidence |
|---|---|---|
| All automated tests pass | Yes | 401/401 |
| Lint clean | Yes | Zero warnings |
| Production build succeeds within budget | Yes | 640.69 kB / 650 kB |
| Zero known critical defects | Yes | See §8 |
| Accessibility conformance verified | Yes | axe-core clean, both viewports |
| Key guarantees mutation-checked | Yes | §4 |
| UAT completed | **No — N/A** | No users. See §9 |

---

## 8. Open defects

| ID | Severity | Summary | Status |
|---|---|---|---|
| KI-04 | **High** | Talent pool has no fair scoping — a candidate registered for no fair still appears to every employer | Open, analysed, plan agreed |
| KI-02 | Medium | Employer pipeline permits any stage transition, including `paid → lead` | Open |
| KI-06 | Medium | PDF import never run against a genuine LinkedIn export | Open |
| KI-05 | Medium | No right-to-erasure implementation | Open — blocks real personal data |

No critical defects open. Full detail and reasoning in document 07.

---

## 9. UAT

**N/A.** No user acceptance testing was performed, because the system has no
users — it is a portfolio demonstration with four fictional identities and
fictional data. A UAT sign-off table here would record a ceremony with invented
participants.

What exists instead: the intended reviewer walks the deployed demo. Each phase
summary in `docs/06`–`docs/11` names the specific pages and interactions to
check for that phase.

---

## 10. Recommendation

**GO for its stated purpose** — a portfolio demonstration and the frontend half
of a system whose backend is still to be written.

**NO-GO for production use with real people's data**, on these grounds, each of
which is a deliberate scope decision rather than a defect:

1. No authentication (ADR-003).
2. No persistence — all state resets on reload.
3. No right to erasure (KI-05), which PDPA 2010 requires before real personal data.
4. The talent pool's missing fair scoping (KI-04) would expose candidates to employers they never consented to.

Items 1 and 2 are resolved by building the Laravel backend the API contract was
designed for. Items 3 and 4 are work in their own right, and 4 should be done
regardless — the plan is already agreed.
