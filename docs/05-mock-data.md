# 05 — Mock Data & Mock API

## Rules

- **All data is fictional.** Fictional people, fictional companies, `example.com` emails, `+60 12-000 xxxx` style phones.
- Real Malaysian **universities, cities, and venues** may be used for realism (they are public places, not people or clients).
- Do **not** use real company names as employers. It could imply a business relationship that does not exist.
- Generate seed data with a **fixed-seed PRNG** (e.g. a small `mulberry32(seed)` function in `seed/random.ts`) so the demo looks the same on every load. No faker dependency.
- **Dates are relative to "today"** at seed time, so the demo always has an upcoming, a live, and a past fair.

## Volumes

| Entity | Count | Notes |
|---|---|---|
| Users | 4 | 1 staff, 2 employers (different companies), 1 job seeker mapped onto `cand-001` |
| Fairs | 5 | See below |
| Booths | 40 per fair × 7 fairs = 280 (5 rows × 8 cols; rows A–E) | Row A = platinum, B = premium, C–E = standard |
| Employers | 60 | Spread across all stages |
| Candidates | 300 | Enough to make pagination and filters meaningful |
| Shortlists | 6 | For employer 1, so the demo is not empty |
| Interview slots | 21 per fair day (10:00–17:00, 20 min), seeded **only for `emp-001` and `emp-002`** across `fair-01`–`fair-03` | ~250 records. 3 pre-booked for employer 1. Seeding all 60 employers would be ~7,000 records that nothing in the demo ever reads; the handler generates slots on demand if another employer is requested |

## Users

| id | name | role | employerId |
|---|---|---|---|
| `u-staff-1` | Farah Iskandar | staff | null |
| `u-emp-1` | Daniel Lim | employer | `emp-001` (Paid, has booth in the next fair) |
| `u-emp-2` | Priya Nair | employer | `emp-002` (Confirmed, no booth yet) |
| `u-seeker-1` | Ahmad Zaki Abdullah Sani | job_seeker | `cand-001` — the same record employers browse |

## Fairs

| id | name | venue | city | dates (relative) | status |
|---|---|---|---|---|---|
| `fair-01` | KL Career Discovery Fair | Sunway Pyramid Convention Centre | Petaling Jaya | today → today+1 | live |
| `fair-02` | National Career Fair | MITEC | Kuala Lumpur | +21 → +22 days | open |
| `fair-03` | Northern Tech & Semicon Career Fair | Penang convention venue | George Town | +45 days | open |
| `fair-04` | Southern Graduate Career Fair | Johor Bahru convention venue | Johor Bahru | +90 days | draft |
| `fair-05` | Graduate Career Fair (Previous) | MITEC | Kuala Lumpur | -60 → -59 days | completed |
| `fair-06` | Sarawak Digital Careers Fair | Borneo Convention Centre Kuching | Kuching | -8 → -7 days | **open** |
| `fair-07` | KL Engineering Careers Fair | Kuala Lumpur Convention Centre | Kuala Lumpur | -180 → -179 days | completed |

`fair-06` is the interesting one: its dates have passed while its status still
says open, because nobody closed it out. It is the reason the fair list groups
into three rather than two — Past is a fair needing attention, Complete is an
archive — and without it in the seed the Past group would never appear.

Booth fill: **derived from the booths, not set per fair.**

The original targets (fair-01 ~95%, fair-02 ~70%, fair-03 ~40%, fair-04 0%, fair-05 100%) cannot all hold. They need 122 occupied booths, and 38 at a single fair, but the stage distribution below yields only **30 committed (confirmed + paid) employers**, each holding at most one booth per fair. The ceiling is 120 in total and 30 at any one fair — so fair-01 can never exceed 75% and fair-05 can never reach 100%.

`buildMockDb` therefore computes each fair's `boothAssigned` from the seeded booths, which keeps the floor plan, the fair list and the dashboard consistent with each other. Attendance is weighted per fair so the *shape* of the original story survives:

| Fair | Status | Fill | Eligible employers | Left unassigned |
|---|---|---|---|---|
| fair-01 | live | 26/40 (65%) | 30 | 4 |
| fair-02 | open | 16/40 (40%) | 20 | 4 |
| fair-03 | open | 14/40 (35%) | 18 | 4 |
| fair-04 | draft | 0/40 (0%) | 0 | 0 |
| fair-05 | completed | 28/40 (70%) | 28 | 0 |
| fair-06 | open, ended | 7/40 (18%) | 11 | 4 |
| fair-07 | completed | 28/40 (70%) | 28 | 0 |

Adding `fair-06` and `fair-07` shifted every later draw from the shared seeded
random, which is why fair-02 and fair-03 differ from the figures this table
carried before. `fair-03`'s weight was raised from 0.4 to 0.65 to bring it back
near the ~40% the original story wanted; it had fallen to 1/40.

Each open fair deliberately keeps **4 committed employers without a booth**, because flow F1 is "drag an unassigned employer onto a booth" and a fully allocated fair would have nothing to demonstrate.

## Booth pricing (RM)

| Package | Price |
|---|---|
| platinum | RM 12,000 |
| premium | RM 7,500 |
| standard | RM 3,500 |

## Employers

- Stage distribution (60): lead 15, proposal 12, confirmed 10, paid 20, lost 3.
- Industries: Banking & Finance, Semiconductor, Oil & Gas, FMCG, Telco, Consulting, Technology, Logistics, Healthcare, Property.
- Name pattern: fictional, Malaysian corporate style — e.g. "Meridian Capital Bhd", "Orkid Semiconductor Sdn Bhd", "Kenanga Logistics Sdn Bhd"… Build from word lists: `[prefix] + [industry noun] + [Bhd | Sdn Bhd | Berhad]`. Check no generated name matches a well-known real company.
- `dealValueMyr` = booth package price when stage ≥ proposal.

## Candidates

- Names: balanced mix of Malay, Chinese, Indian, and East Malaysian names from hand-written first/last name lists.
- Universities (sample): Universiti Malaya, Universiti Kebangsaan Malaysia, Universiti Putra Malaysia, Universiti Sains Malaysia, Universiti Teknologi Malaysia, Universiti Teknologi MARA, Multimedia University, Taylor's University, Sunway University, Asia Pacific University, UCSI University, Monash University Malaysia, University of Nottingham Malaysia.
- Fields: Computer Science, Software Engineering, Electrical & Electronic Engineering, Mechanical Engineering, Accounting, Finance, Business Administration, Marketing, Data Science, Actuarial Science, Chemical Engineering, Psychology.
- Qualification weights: degree 70%, diploma 15%, masters 13%, phd 2%.
- Graduation year: current year −2 to current year +1.
- CGPA: 2.50–4.00 (null for ~5%), one decimal pair, skewed toward 3.0–3.6.
- Skills: 3–7 per candidate, drawn from a list matched to field.
- Headline: generated, e.g. "Final-year Software Engineering student, interested in backend systems".
- Email: `firstname.lastname@example.com`. Phone: `+60 1X-000 XXXX`.
- **No sensitive data fields** (race, religion, health, disability).

## Mock API behaviour

| Behaviour | Spec |
|---|---|
| Latency | Random 300–800 ms per request |
| Filtering/sorting/pagination | Done in the handler, same semantics as the API contract |
| Masking | Candidate `email`/`phone` masked unless shortlisted by the current employer; `isContactVisible` reflects this |
| Validation | `POST/PATCH /employers` returns 422 in Laravel format for missing required fields / bad email |
| Fair registrations | One row per (candidate, fair) the candidate seed already paired up | Derived from `Candidate.fairIds`, which stays in step as the handler writes. Consent is backdated to the seed's clock, not to "now" |
| Conflicts | 409 for double-booked slot, duplicate shortlist, assigning an occupied booth without `force: true`, registering twice for one fair, or registering for a closed fair |
| Not found | 404 `{ message: "Fair not found." }` |
| Simulated errors | When enabled, ~20% of requests return 500 `{ message: "Something went wrong on our side." }` |
| Unknown route | 404 and a `console.warn` in dev so missing handlers are obvious |
| Persistence | In-memory. Survives navigation, resets on full reload. `POST /demo/reset` reseeds. Optional: persist to `localStorage` behind a flag |
| Mutations | Return a new object; never mutate objects already handed to the app |
