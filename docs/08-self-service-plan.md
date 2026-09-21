# 08 — Self-Service Roles & Profile Import

Follows `docs/07-ui-refresh-plan.md`. Same working rules: one phase = one cloud session = one branch = one PR, and each phase ends with the standard summary described in `CLAUDE.md`.

This pulls roadmap **R4** (candidate portal) forward and widens it: both sides of the marketplace get to serve themselves, instead of every record being seeded or entered by staff.

---

## Locked decisions

| # | Decision | Why |
|---|---|---|
| **S-D1** | **`Role` becomes `'staff' \| 'employer' \| 'job_seeker'`.** `hiring_manager` is renamed, not joined. | Two names for one concept is the drift `CLAUDE.md` forbids. `Role` was written to extend — "Adding one here must not require restructuring" — and 15 files reference the old name, 7 of them in `src`. Contained. |
| **S-D2** | **Routes stay at `/hiring/*` for the employer section.** | "Hiring" is the activity, not the role. Renaming ~30 files and every route test buys nothing a user can see. Job seekers get `/me/*`. |
| **S-D3** | **Job seekers register instantly; employers are reviewed by staff.** | A job seeker attending a fair costs nothing. An employer attending is a sales conversation and a booth that gets paid for. |
| **S-D4** | **Built on the mock API.** Registration works and looks real, and resets with the demo data. | This is still a portfolio demo. Real accounts need R1 + R2, which is a different project. Every endpoint is shaped the way Laravel will expose it, so R1 stays a swap. |
| **S-D5** | **Profile import parses a PDF in the browser.** No upload, no server, no storage. | The mock has nowhere to put a file, and the CV never leaving the device is the strongest privacy position available — and a true one, which matters under the PDPA. |
| **S-D6** | **A parse never saves silently.** It prefills a form the person confirms. | Résumé parsing is heuristic and is wrong often enough that silent commits would put errors in front of employers under the candidate's name. |
| **S-D7** | **Staff approval of a fair application also moves the employer to `confirmed`.** | Demo decision, taken in S3. The floor plan seats only `confirmed` and `paid` employers, so without it an approval produced somebody who was attending but could not be given a booth — a dead end in the middle of the demo's main path. A real deployment would decouple these: a deal is confirmed when it is signed, not when an application is accepted. |

---

## On "import my LinkedIn data"

The goal — *don't make people retype what they have already typed into five other job sites* — is right, and reachable. The mechanism usually assumed for it does not exist.

**LinkedIn's API will not give you a work history.** The current self-serve product, Sign In with LinkedIn (OpenID Connect), returns exactly `sub`, `name`, `given_name`, `family_name`, `picture`, `email`, `email_verified`, `locale`. Positions, education and skills need a LinkedIn Talent Solutions or Marketing Developer Platform partnership — application-gated, business review, not obtainable for a project like this. The old `r_fullprofile` scope that used to return it was deprecated around 2015 and the v1 API shut down in 2019.

**What works instead is LinkedIn's own PDF export.** A member can open their profile and choose *More → Save to PDF*, which produces a document containing their headline, education, experience and skills. From the person's point of view, uploading that file *is* importing their LinkedIn data. It just travels as a file rather than an API call. It also:

- needs no partnership, no OAuth, and no client secret — so it works in a frontend-only app, which an OAuth flow cannot;
- is user-initiated, so there is no scraping and no terms-of-service question;
- works for someone who is not on LinkedIn at all, because any CV PDF goes through the same path.

**What to avoid:** third-party enrichment APIs (Proxycurl, People Data Labs and similar). They scrape LinkedIn, which breaches its terms and sits in contested legal ground. More to the point here, obtaining a Malaysian person's personal data from someone other than that person is a PDPA 2010 problem, and this project has committed to PDPA compliance since Phase 1.

**What the import realistically fills:** full name, headline, university, field of study, graduation year, and a skills list. **CGPA it cannot** — LinkedIn has no such field, and most CVs do not carry one. That stays manual, which is fine: it is one number.

---

## Part 1 — Roles and self-service

### S1 — Role model

`Role` gains two members and loses one. `User` gains `candidateId`, so a job seeker's account points at the record employers already browse, rather than duplicating it.

The demo cast grows to four: Farah (staff), Daniel and Priya (employer), and one job seeker mapped onto a seeded candidate. `ROLE_HOME`, `roleGuard`, the side nav and the role switcher all take the new member.

*Risk: low.* Mechanical, and the specs covering guards and routing will catch a miss.

### S2 — Job seeker self-service

- A public fair listing, showing open and live fairs with dates, venue and who is attending.
- **Register for a fair**, instantly (S-D3), with an explicit consent step.
- **My fairs** — what they registered for, and the ability to withdraw.
- **My profile** — their own record, editable, the same one employers see in the talent pool.

**Consent is not a checkbox for show.** Registering makes a person's profile visible to employers at that fair, so the registration step says exactly that, in those words, and records the choice. PDPA 2010 requires consent to be informed and specific; a pre-ticked box buried in a form is neither. Contact details stay masked until an employer shortlists them, exactly as now — the existing rule already does the right thing and must not regress.

*Risk: medium.* Touches the talent pool's masking rules from the other side.

### S3 — Employer self-service and the staff queue

- An employer **applies** to attend a fair; the application lands as `pending`.
- Staff get a **Registrations** screen — approve, or reject with a reason — which is a surface they do not have today.
- The employer sees their own status, and the reason if they were turned down.
- An approved employer becomes eligible for booth assignment on the existing floor plan.

Whether an approved employer should also appear as a Lead on the sales pipeline is a business rule, not a technical one. Left out until asked.

*Risk: medium.* New state that the floor plan and the pipeline both read.

---

## Part 2 — Profile import

### S4 — Import from a PDF

The button says **Import from LinkedIn**, because that is what the person is doing. Behind it: a short instruction (*LinkedIn → your profile → More → Save to PDF*), a file picker that also accepts any CV, and then a form showing what was found — every field editable, nothing saved until they confirm.

**The parser will be wrong sometimes.** LinkedIn's PDF layout is not a contract and will change. That is designed around rather than hidden: fields it is unsure about are shown empty rather than guessed, and the person is looking at the result before anything is stored. A well-built manual form with autocomplete on university, field and skills is the primary path regardless — the import is an accelerator, not a replacement.

### Constraints that shape this

- **Bundle.** The initial bundle is 637.99 kB against a 650 kB warning budget — **12 kB of headroom**. `pdfjs-dist` is an order of magnitude larger than that, so it must load through a dynamic import, reached only when someone clicks Import. The same pattern already keeps chart.js and the mock seed data out of the initial bundle.
- **CSP.** The production policy is `script-src 'self'` with no `unsafe-eval` (Phase 7). pdf.js runs its parser in a worker and, in some configurations, wants `eval`. The worker is same-origin so it should fall back to `default-src 'self'` and pass, and pdf.js accepts `isEvalSupported: false`. **Both need verifying against the real build behind the real headers before this is called done** — Phase 7 already found one inline handler the CSP blocked.
- **New dependency.** `pdfjs-dist`, which `CLAUDE.md` says to ask about before adding. Not yet approved.
- **Scope.** PDF only. DOCX parsing is a different library and a larger surface, and LinkedIn exports PDF.

*Risk: highest of the four.* A third-party parser, a web worker, a tight budget and a strict CSP, all at once.

---

## Deliberately out of scope

- **QR check-in passes** (roadmap R4). Worth doing, unrelated to either half of this, and better as its own phase.
- **Real accounts.** S-D4. Everything here resets with the demo data.
- **LinkedIn OAuth sign-in.** Ruled out above — it cannot be built without a backend to hold the client secret, and it would not deliver the profile data that was the point.

---

## Facts discovered

### S3

- **Putting an employer on a fair was not enough to make them seatable, and that took a business decision.** Approving adds the fair to `employer.fairIds`, which puts them on the fair's Employers tab — verified in-session, 27 rows → 28. But the floor plan's "Without a booth" list also gates on `stage === 'confirmed' || 'paid'`, and an applicant is typically a `lead` (the seed gives leads no `fairIds` at all, which is exactly why they are the ones with something to apply for), so the first cut approved people who then could not be seated. **Decision (S-D7): for the demo, approval also moves the employer to `confirmed`.** Verified in-session: the side list goes 4 → 5 and the approved employer is in it.
- **Advancing a stage means honouring that stage's invariants.** `Employer` requires `lostReason` to be null for every stage but `lost`, and ties `dealValueMyr` to the booth package for `proposal` and beyond. `acceptEmployer()` therefore does what `PATCH /employers/{id}` does rather than setting one field: it clears the lost reason (approval revives a lost employer) and derives the deal value from the package. It also never walks `paid` back to `confirmed` — being accepted for a second fair should not cost an employer a deal they already closed. A rejection leaves the pipeline untouched.
- **A `page.goto` rebuilds the mock database from its seed.** The first run of the S3 browser check navigated to the floor plan by URL and reported the approval had not reached it — which was the harness reloading the app, not the app losing the change. Every cross-page assertion here stays inside the SPA. This is the second time this exact trap has produced a false finding; it is worth assuming for any future check that spans two screens.
- **Rejection needs a reason in two places, and only one of them is a UI.** The dialog cannot be confirmed empty, and `PATCH /fair-applications/{id}` 422s on a blank or whitespace-only reason regardless. A dialog is a convenience; the API is the rule. The reason is trimmed server-side, verified end to end: `'  Not enough graduate roles.  '` reaches the employer as `'Not enough graduate roles.'`
- **A decided application cannot be decided again — 409, not a silent overwrite.** Two organisers can have the queue open at once; the first decision stands and the second is told so, then the list resyncs. The same non-optimistic reasoning as S2's registration: approving changes what other staff see, so nothing is shown as done before the server agreed.
- **An employer asking to decide gets 404, not 403.** Consistent with S2's withdraw rule: a 403 would confirm the id exists.
- **A rejection is not a permanent bar.** A rejected employer may apply again — the reason may be something they can fix — but a pending or approved one may not, or staff would review the same request twice. `applicationFor()` in the store therefore prefers a non-rejected row over the latest one.
- **The nav spec caught both new links.** Adding Registrations and the employer Fairs entry failed `side-nav.component.spec.ts` immediately, which is the record over `Role` doing its job for the second phase running.
- **Verified:** 15 pages at three viewports and both new dialogs at two, 0 axe violations, 0 CSP violations. In a browser: the queue reads "Awaiting review (4)", approving drops it to 3 with a snackbar naming the employer and fair, an empty rejection is blocked with "A reason is required", the decided filter shows both outcomes with the reason, an employer applying moves their card to "Applied — awaiting review", and the new row appears in the staff queue after switching back.
- **Cost:** initial total 638.77 kB → 639.04 kB.

### S2

- **`maskForViewer` masked a job seeker from themselves.** Contact details were visible only to an employer who had shortlisted the candidate, so the first render of "My profile" would have starred out the person's own email. A viewer is not a third party to their own record; `viewer.candidateId === candidate.id` now unmasks. Verified both directions in a browser: the job seeker sees `jia.hui@example.com`, an employer who has not shortlisted them sees `a***@example.com`.
- **Consent is a row, not a boolean.** `Candidate.fairIds` could have carried registration on its own, but PDPA 2010 wants consent that can be shown to have been given, for a stated purpose, at a time. `FairRegistration` records `consentedAt`; the handler keeps `fairIds` in step so the talent-pool filter still reads one field.
- **The API refuses to default consent.** `POST /fair-registrations` 422s unless `consent === true` — not merely truthy. A payload that can omit consent is a UI that can forget to ask for it, and the test suite asserts both the missing case and a `'yes'` string.
- **Withdrawing someone else's registration returns 404, not 403.** A 403 would confirm the id exists.
- **Browse and "my fairs" are one page with a filter.** Two pages would have listed the same fairs in the same cards, differing only by predicate.
- **The profile page is read-only, deliberately.** Editing belongs with S4, where the import fills a form the person corrects. Building an edit form now and replacing it then would be the same work twice.
- **A Playwright `getByRole` name is a substring by default**, so `{ name: 'Register' }` also matched the "Registered (2)" filter button and the first test clicked the wrong one. `exact: true` where two controls share a prefix.
- **Verified:** 13 pages at three viewports, 0 axe violations, 0 CSP violations. In a browser: the job seeker lands on `/me/fairs`, the consent dialog's Register button is disabled until the box is ticked, registering moves the count 2 → 3, withdrawing asks first and moves it back.
- **Cost:** initial total 638.19 kB → 638.77 kB. The portal is one lazy chunk.

### S1

- **The rename was the easy half; the ternary was the real bug waiting to happen.** `items()` in the side nav was `isStaff() ? STAFF_NAV : EMPLOYER_NAV`, which is correct with two roles and silently wrong with three — a job seeker would have been handed the employer's menu, every link of which `roleGuard` blocks. It is a `Record<Role, …>` now, so the compiler names a forgotten role instead of picking one. The same change was made to the switcher's labels.
- **A stale id in `sessionStorage` cannot strand anyone.** Demo user ids changed (`u-hm-1` → `u-emp-1`), so anyone mid-session carries an id that no longer exists. `restoreUser()` already falls back to the first demo user for an unknown id — the "stale or tampered id" case the T2 tests cover — so the rename needed no migration step.
- **`ROLE_HOME` points `job_seeker` at `/me`, which does not exist yet.** That is deliberate: the record is exhaustive over `Role`, which is what makes the compiler catch a missed role, and no demo user has the role until S2 builds the pages behind it. Adding the user before the pages would have shipped a switcher entry that lands on a 404.
- **Phase records were left alone.** `docs/06` and `docs/07` still say "hiring manager" because they describe what happened at the time. The living specs — `docs/01`, `02`, `04`, `05` and `CLAUDE.md` — were updated.
- **236 existing tests passed unchanged**, which is the real proof a rename is safe. Three new ones cover the nav record, including that a role with no pages renders an empty nav rather than someone else's.
- **Cost:** initial total 637.99 kB → 638.19 kB.
