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

## J2 — The detail shell

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

## J3 — Jobs tab

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

## Risks

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
