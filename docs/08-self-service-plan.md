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

<!-- Each phase appends what it learned, as docs/06 and docs/07 do. -->
