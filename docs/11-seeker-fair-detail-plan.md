# 11 — Job seeker fair detail

A job seeker can currently see a fair only as a card: name, venue, dates, a
count, and a Register button. This adds the thing that makes a fair worth
attending — **who is hiring, and for what**.

Three phases, J1–J3, one per session.

## What the investigation found first

Two facts shaped every decision below, and both were established by reading
the code rather than assumed.

**Job openings do not exist.** There is no vacancy, opening or role model in
`src/app/core/models/` — twelve models, none of them this — nor in the seed,
nor anywhere in docs/08. This is a new entity with new seed data and new
endpoints, not a new view over data we already hold.

**`GET /employers` has no role gate.** `listEmployers`
(`employers.handler.ts:88`) filters by `stage`, `fair_id` and `search` and then
returns the whole `Employer` record: `stage`, `dealValueMyr`, `contactEmail`,
`contactPhone`, `notes`, `lostReason`. The obvious way to build this feature —
call `/employers?fair_id=X` — would hand a job seeker the entire sales
pipeline. Only `employers.store` and `floor-plan.store` call that endpoint, and
both are staff-only surfaces, so closing it costs nothing.

## Decisions

| | Decision | Why |
|---|---|---|
| **J-D1** | **A seeker-safe projection type, not a masked `Employer`.** `GET /fairs/:id/exhibitors` returns `FairExhibitor`, which has no commercial fields at all. | Masking (the `maskForViewer` precedent in `candidates.handler.ts:23`) leaves `dealValueMyr` on the object the component holds, so nothing stops a future template printing it. A projection makes the guarantee structural rather than behavioural. The cost is a second type where candidates got away with one. |
| **J-D2** | **`GET /employers` and `GET /employers/:id` become staff-only**, answering 404 rather than 403. | The same answer the rest of this API gives, so the response does not confirm the record exists. Independent of J-D1: the projection is the feature, the gate is the hole. |
| **J-D3** | **"Attending" means holding a booth, not appearing in `fairIds`.** | `fairIds` includes leads who were never accepted — showing them to a seeker would advertise employers who are not coming. Booths are also what the app already means by this: the seeker fair card labels `fair.boothAssigned` as "Employers attending". And a booth carries a code, which is what a seeker actually uses on the day. |
| **J-D4** | **Three tabs: Jobs, Employers, Details. Jobs is the default.** | Seekers browse by role, not by company. A flat filterable list answers "what internships are here" in one read; nested-under-employer answers it by opening twenty-five cards. |
| **J-D5** | **Salary is an optional range**, rendered `RM 3,000 – 4,500 / month`, null on some seeded openings. | Matches how many Malaysian postings actually disclose, and exercises the null path in the UI rather than pretending it cannot happen. |
| **J-D6** | **Openings overlapping the seeker's own skills get a quiet marker** and an optional "matching only" filter. | `Candidate.skills` already exists and openings draw from the same vocabulary, so this is nearly free. It is also the clearest demonstration of why the profile is worth filling in. Marker and filter only — the default sort stays predictable, because a clever sort hides rows people were looking for. |
| **J-D7** | **`Fair` gains `description`, not `address`.** | One paragraph makes the Details tab worth opening. `venue` + `city` already locates the place, and a street address would mean seeding seven plausible ones and deciding who may edit them. |

## J1 — Model, seed, API

No UI. The phase is done when the endpoints answer correctly and the gate holds.

**New model** — `src/app/core/models/job-opening.model.ts`:

```ts
export type EmploymentType = 'full_time' | 'internship' | 'contract';
export type ExperienceLevel = 'fresh_graduate' | 'junior' | 'mid' | 'senior';

export interface JobOpening {
  readonly id: string;
  readonly employerId: string;
  readonly fairIds: readonly string[];
  readonly title: string;
  readonly jobFunction: string;
  readonly employmentType: EmploymentType;
  readonly experienceLevel: ExperienceLevel;
  readonly location: string;
  /** Same vocabulary as `Candidate.skills`, which is what makes J-D6 work. */
  readonly skills: readonly string[];
  /** Monthly, in MYR. Null when the employer did not disclose (J-D5). */
  readonly salaryMinMyr: number | null;
  readonly salaryMaxMyr: number | null;
  readonly headcount: number;
  readonly postedAt: string;
}

/** What a job seeker is allowed to know about an employer (J-D1). */
export interface FairExhibitor {
  readonly employerId: string;
  readonly name: string;
  readonly industry: string;
  readonly companySize: CompanySize;
  readonly boothCode: string;
  readonly openingCount: number;
}
```

`Fair` gains `description: string` (J-D7). `MockDb` gains `jobOpenings`.

**Endpoints** (all three are GETs, so none needs an `AuditDescriptor` — the
handlers spec only asserts that non-GET routes are logged):

- `GET /fairs/:id/exhibitors` — booths at this fair with an employer, joined to
  the employer record, projected to `FairExhibitor`. Open to every role;
  nothing in the shape is sensitive.
- `GET /fairs/:id/job-openings` — openings whose `fairIds` include this fair,
  with `employerName` and `boothCode` denormalised so the list renders without
  a second request. Filters: `function`, `type`, `level`.
- `GET /employers`, `GET /employers/:id` — gated to staff (J-D2).

Route order matters: `/fairs/:id/exhibitors` and `/fairs/:id/job-openings` must
be registered **before** `/fairs/:id`, which the route table already documents.

**Seeding** — `seed-job-openings.ts`, roughly four to eight openings per
employer holding a booth, titles and skills drawn from the existing word lists.

> It takes its **own `SeededRandom` instance** rather than sharing the one
> threaded through the other seeds. Appending to the shared sequence is what
> silently dropped fair-03's booth fill from 0.4 to 1/40 when seed fairs were
> added, and that took a browser session to find.

**Verification:** handler specs for both new endpoints, plus a spec asserting a
job seeker gets 404 from `/employers`. A browser check that the response body
for `/fairs/:id/exhibitors` contains no `dealValue`, `stage`, `contactEmail`,
`contactPhone` or `notes` key at all.

## J2 — done

`/me/fairs/:fairId` with an Employers tab and a Details tab, reached by
clicking a fair's name on the list. 393 tests, lint clean, initial bundle
unchanged at 640.69 kB, axe-core clean on all six new states at 1440px and
390px with no horizontal scroll.

`''` redirects to `employers` for now. J3 replaces that one line with the Jobs
tab, which breaks no URL that works today.

**Register and withdraw moved into `FairRegistrationActions`.** Neither is a
plain API call — registering collects consent first, withdrawing confirms
first, both have a 409 path and both announce to a screen reader — and the
Details tab needed the same behaviour the fair card already had. Same reasoning
as `RegistrationDecisions` on the staff side, and the card now delegates to it
too rather than keeping a second copy.

**A bug found only by opening the page.** The shell guards against rendering a
stale fair under a new heading by checking `loadedId() === fairId()`. But a
failed load clears `loadedId`, so `!isCurrent()` stays true afterwards — and
with the skeleton tested before the error branch, a fair that 404s sat on a
loading skeleton for ever with the Retry button unreachable. Every test passed
while that was true; `/me/fairs/fair-99` in a browser showed it immediately.
Error is now checked first, and a spec covers it.

**A verification result that was wrong.** The first end-to-end check registered
for a fair, navigated to the list with `page.goto`, and counted two registered
cards instead of three — which looks like the write not reaching the list.
`page.goto` reloads the app, and the mock database is in memory, so it reseeds:
the "2" was the seeded state, not the outcome. Redone with in-app navigation,
the count goes 2 → 3.

**Mutation-checked.** Restoring the skeleton-before-error ordering, and
replacing `isOpenForSignup` with a plain status check, each fail exactly the
test written for them.

## J2 — the detail shell (as planned)

Route `/me/fairs/:fairId`, built as a routed shell with `mat-tab-nav-bar` +
`mat-tab-nav-panel` + `router-outlet` — the same structure as the staff fair
detail (`fairs.routes.ts:13`), so the two halves of the app stay one app. A
page rather than a modal: there is far more here than a modal should hold.

- `SeekerFairDetailPageComponent` — shell, loads the fair, renders the tabs
- `SeekerFairDetailsTabComponent` — description, dates, venue, status, how many
  are registered, this seeker's own registration state and consent date, and
  Register / Withdraw
- `SeekerFairExhibitorsTabComponent` + `ExhibitorCardComponent` — the directory,
  each card carrying the booth code and a link into the Jobs tab filtered to
  that employer
- `SeekerFairDetailStore`

The fair card on `/me/fairs` gains a link into this page.

## J3 — done

The Jobs tab is the landing tab at `/me/fairs/:fairId`. 401 tests, lint clean,
initial bundle unchanged at 640.69 kB, axe-core clean on all four new states at
1440px and 390px.

Filters: search, field, employment type, experience level, and "matches my
skills". All of them run client-side over one fully-loaded list rather than
being split with the server. The endpoint's `function`/`type`/`level` filters
are real and tested, and another caller should use them — but "matches my
skills" cannot be a server filter here, because the server has no notion of
whose skills. Filtering a server-returned page again on the client would report
a count for the page rather than the fair. At a scale where loading the list
stopped being reasonable, the skill match is what should move server-side, not
the pagination.

**Three defects the browser found that the tests did not.**

Salary rendered as `RM3,500–4,700/ month`. Angular collapses template
whitespace, so the newlines between the adjacent spans vanished and the figure
came out as one run-on token. The line is a flex row with a gap now, which is
layout rather than content and survives the collapsing.

Searching "intern" returned nothing while the Type filter beside it held 19
internships, because the haystack covered title, employer, field and skills but
not the type. That reads as "there are none here" rather than "use the other
control". The type and level labels are searchable now: "intern" returns 14 of
87.

And the three existing spec files broke in a way that looked much worse than it
was. Adding the openings request meant they flushed two of three requests, so
`http.verify()` threw — and a failed verify leaves the TestBed instantiated,
which made *unrelated* spec files fail with "Cannot configure the test module
when the test module has already been instantiated". The actual cause was
narrow: `expectOne(string)` matches `urlWithParams`, and this request carries
`per_page`. A predicate matcher fixes it, which is the pattern
`fair-employers-tab.component.spec.ts` already used for the same reason.

**A verification of mine that was wrong again.** The first check reported no
salary figures rendering at all. The regex was `/RM\s/`, and at that point the
spans had no whitespace between them — so the check failed for the same reason
the display was wrong, and I nearly read it as "salaries are missing". Counting
the rendered lines directly showed 52 of 87 with figures and 35 without, which
is the ~60% disclosure rate the seed is built for.

**Mutation-checked.** Replacing the profile-overlap match with "every skill
matches" fails all three of the tests written for it.

**Worth knowing about the demo data.** The seeded job seeker is an electrical
engineering student, and only 2 of fair-01's 87 roles overlap their skills. The
match feature is correct but looks thin. That is honest seed data rather than a
bug, and rigging it would make the feature look better than it is — but if the
demo needs the marker to show up more, the fix is to give the seeded candidate
a broader skill set, not to loosen the match.

## J3 — Jobs tab (as planned)

- `SeekerFairJobsTabComponent` — filters for function, employment type,
  experience level, and "matching my skills"
- `JobOpeningCardComponent` — title, employer, booth code, type and level as
  chips, location, salary when present, headcount, skills, and the J-D6 match
  marker

## Components

**Reused rather than rebuilt.** `PageHeaderComponent`, `StatusChipComponent`,
`SkeletonComponent` / `ErrorStateComponent` / `EmptyStateComponent` (every view
keeps the four states), `BusyLabelComponent` on Register and Withdraw,
`mat-tab-nav-bar` / `mat-tab-nav-panel` / `router-outlet`, the `.fo-figure`
treatment from docs/10 for the stat figures, and the `.skill` chip styling from
the candidate dialog for the function and level tags.

**Deliberately not used.** `MatExpansionPanel` — it would be a new Material
import and the openings list does not need one. No new dependency is required
for any of this.

## J1 — done

Shipped as planned, with one decision corrected and three risks resolved. 381
tests pass, lint clean, initial bundle unchanged at 640.69 kB.

**The three risks, settled by measurement rather than argument:**

- **The `/employers` gate breaking existing specs — not real.**
  `employers.store.spec.ts` and `floor-plan.store.spec.ts` use
  `provideHttpClientTesting`, which replaces the HTTP backend outright, so the
  mock interceptor never runs in them. All 363 pre-existing tests passed
  unchanged the moment the gate went in. The risk was written from reading the
  store code without checking how its spec provides HTTP.
- **Seed volume — over-estimated by half.** The plan guessed ~200 openings; the
  seed produces **99** across 30 hiring employers, 87 of them visible at the
  busiest fair. Well under the talent pool's 300, and
  `/fairs/{id}/job-openings` is paginated regardless, so a fair's list never
  renders more than a page at once. The `mock-engine` lazy chunk grew 34.77 kB
  → 40.56 kB; the initial bundle did not move, because the seed has never been
  in it.
- **`Fair.description` touching staff surfaces — absorbed.** Adding a required
  field only obliges the seed to supply one; every reader keeps compiling. All
  seven fairs got a paragraph.

**One thing checked that the plan had not thought to ask.** The exhibitor list
counts distinct employers holding a booth, but the fair card counts booths. If
one employer held two booths at a fair the two numbers would disagree in front
of the user. They do not: at fair-01, 26 booths, 26 distinct employers, and
`boothAssigned` is 26 — `buildMockDb` recomputes that field from the booths,
which is why the literal `38` in `seed-fairs.ts` is not what ships.

**A verification attempt that proved nothing, and what replaced it.** The first
browser check called the endpoints with `fetch()` and got 200 from all three
roles. That was not the gate failing — a raw `fetch` never reaches an Angular
interceptor, so it was the static server returning `index.html` for every path.
The real boundary is `runMockRequest`, which is what the interceptor calls and
where `currentUser` is threaded through from the auth store. There is now a
spec at that level, and it also applies `toSnakeCase` the way the interceptor
does, so the leak check reads the keys that actually cross the wire rather than
their camelCase names.

**Mutation-checked.** Spreading the `Employer` into the exhibitor projection,
adding a single `notes` field to it, and removing the staff gate each fail
exactly the test written for them — at both the handler and the wire level.

## Risks (as written before J1; see above for what became of them)

- **The `/employers` gate may break existing specs.** `employers.store` and
  `floor-plan.store` specs construct requests without a role context. Expected,
  cheap to fix, but it is the one change that touches code this feature does
  not otherwise go near.
- **Seed volume.** Roughly 25 employers with booths × up to 8 openings is ~200
  rows across 7 fairs. Worth checking the bundle and the talent-pool-sized
  render cost before assuming it is free.
- **`Fair.description` touches staff surfaces.** Adding a field to a shared
  model means the staff fair detail and the fair list both see it. Neither has
  to show it, but both have to keep compiling.


---

## V2 — done (25/09/2026)

A Candidates tab on the staff fair detail, at
`/staff/fairs/:fairId/candidates`. Reads `GET /candidates?fair_id=X`, which
already existed and was already tested — V2 needed no API change at all.

Contact details arrive masked and stay that way (V-D3). The table has **no
contact column**: every value would be the same masked string, so it would be
25 identical cells taking width from the fields staff actually read. The rule
is stated once above the table with an example instead, so a reader knows the
masking is deliberate rather than missing data.

**Two things the screenshot showed that the numbers did not.** A column of 25
identical `a***@example.com` cells, and a headline that wrapped to two or three
lines and made every row a different height — which is exactly what docs/07
UX-3 established makes a table unscannable. Rows are a uniform 48px now.

**A guard that did not survive mutation, and was removed rather than kept.**
The tab first carried an `isCurrent` check — "do these rows belong to the fair
in the URL" — mirroring the seeker fair shell. Deleting it broke no test, twice,
including one written specifically for it. The reason is that `load()` sets its
status synchronously before the template is evaluated, so `isLoading()` already
covers every frame in which a stale list could appear. Shipping provably
unreachable code with a comment claiming it prevents something is worse than
not having it, so it and the store field behind it are gone and the template
says why.

> **Worth checking:** `SeekerFairDetailPageComponent` carries the same
> `isCurrent` pattern, added in J2. Its test passes, but by the same reasoning
> it may also be unreachable. Not changed here — it should be mutation-tested
> on its own rather than removed by analogy.

**V3** (consent and profile copy) is the last item.
