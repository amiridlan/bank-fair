# Known Issues & Maintenance — BankFair

| Field | Value |
|---|---|
| Document ID | KI-001 |
| Version | 1.0 |
| Date | 25/09/2026 |
| Status | Current |

What is not done, what would break, and what the next person needs to know.
Every item was verified against the code on 25/09/2026 — none is speculative,
and each says how it was confirmed.

Severity here means impact **if this system held real data and real users**,
not impact on the demo.

---

## 1. Open issues

| ID | Severity | Summary |
|---|---|---|
| [KI-01](#ki-01) | Critical (for production) | No authentication |
| ~~KI-04~~ | ~~High~~ | ~~Talent pool has no fair scoping~~ — **closed 25/09/2026, see below** |
| [KI-05](#ki-05) | High (for production) | No right to erasure |
| [KI-02](#ki-02) | Medium | Pipeline permits any stage transition |
| [KI-06](#ki-06) | Medium | PDF import never tested against a real export |
| [KI-03](#ki-03) | Medium | Approval confirms the deal |
| [KI-07](#ki-07) | Low | Skill matching barely visible in the demo |
| [KI-08](#ki-08) | Low | No deployment or operations documentation |
| [KI-09](#ki-09) | Low | `Live` chip borrows warning semantics |

---

<a id="ki-04"></a>
## KI-04 — Talent pool has no fair scoping · **CLOSED 25/09/2026**

> **Fixed by V1.** `canViewCandidate` now gates both `listCandidates` and
> `getCandidate`. An employer sees only candidates registered for a fair that
> employer is attending — tagged to it **and** at stage `confirmed` or `paid`.
> A job seeker sees their own record and no other. Staff see every registrant,
> masked (V-D3).
>
> Verified end to end in a browser: the demo employer's pool went from 300 to
> 270 candidates, and after the demo job seeker withdrew from both their fairs
> it fell to 269 and a search for them returned zero rows. Four mutations of
> the rule each failed the test written for them.
>
> **V2** (the staff Candidates tab at `/staff/fairs/:fairId/candidates`) and
> **V3** (consent and profile copy) remain open. Neither is a correctness
> defect — the `fair_id` filter V2 needs already exists and is tested.
>
> The original entry follows, unedited, because it explains why this mattered.

---

**The most significant outstanding defect.** Not a scope decision — a genuine
hole with an agreed plan that has not been executed.

### What is wrong

An employer's talent pool lists every candidate in the database, regardless of
whether that candidate registered for any fair the employer is attending — or
for any fair at all.

Confirmed in the code on 25/09/2026:

- `listCandidates` (`candidates.handler.ts:98`) *supports* an optional `fair_id` filter, but `talent-pool.store.ts` never sends one. Zero occurrences of `fair_id` in that store.
- `getCandidate` has **no visibility check whatsoever** — it masks contact details by viewer, then returns any candidate to any employer who knows the id.

Observed behaviour: a job seeker who withdrew from every fair still appears in
an employer's talent pool, while their own profile page correctly tells them
they are "not visible to any employer". The app contradicts itself, and the
side that is wrong is the one facing the employer.

### Why it matters

Registration is a **consent event**, recorded with a timestamp precisely so it
can be shown that a person agreed to be visible to employers at a named fair.
Showing that person to an employer they never consented to makes the consent
record decorative. Under PDPA 2010 that is the substantive failure, not a
cosmetic one.

### Agreed fix, not yet done

Decisions were taken earlier and are still the right ones:

| Ref | Decision |
|---|---|
| V-D1 | An employer sees the union of candidates registered for the fairs that employer is attending |
| V-D2 | Staff get a Candidates tab on the fair, at `/staff/fairs/:fairId/candidates` |
| V-D3 | Staff see candidate contact details masked, like employers |

Work:

- **V1** — enforce visibility server-side in `listCandidates` **and** `getCandidate`. Server-side, not a client filter: a UI that scopes is a UI that can be made to stop scoping.
- **V2** — the staff Candidates tab.
- **V3** — update the consent and profile copy to match what the system actually does.

**V1 should be done before anything else on this list.** It is the only open
item where the system's behaviour contradicts a promise it makes to a user.

*Done, 25/09/2026. See the note at the top of this entry.*

---

<a id="ki-01"></a>
## KI-01 — No authentication · Critical for production, by design

Identity is a `sessionStorage` switcher with four fixed demo users and no
credentials (ADR-003). Every occurrence carries a demo-only comment.

**This is a deliberate scope decision, not an oversight** — but it is the item
most likely to be misread, so: the system has *authorisation* (role guards plus
a role check in every handler) and no *authentication* at all.

**Resolution.** Laravel Sanctum, as part of the backend build. The handler-level
role checks port directly to Laravel policies; the route guards are convenience
and can stay as they are. No feature code changes.

---

<a id="ki-05"></a>
## KI-05 — No right to erasure · High for production

PDPA 2010 gives a data subject the right to have personal data deleted. The
system has no mechanism: withdrawing from a fair removes the registration and
re-hides the profile, but the candidate record persists, and there is no
account deletion.

It does not bite today — all data is fictional and resets on reload — but it
**blocks any deployment holding real personal data**.

**Resolution.** Part of the backend build. Needs a policy decision first on
what erasure means for an audit trail: the audit log deliberately stores no
personal values (ADR-009), which was designed partly so that erasing a
candidate does not require rewriting history. That design should be preserved.

---

<a id="ki-02"></a>
## KI-02 — Pipeline permits any stage transition · Medium

The employer pipeline has rules about what a transition *requires* — Lost needs
a reason, Paid needs a booth package — but no rule about which transitions are
**legal**. `paid → lead` is permitted. So is `lost → paid` without clearing the
lost reason.

**Resolution.** A transition table declaring legal moves, enforced in the
handler and reflected in what the UI offers. Small and well-understood; it has
simply never been the most valuable thing to do next.

---

<a id="ki-06"></a>
## KI-06 — PDF import never tested against a real export · Medium

The LinkedIn PDF import has 28 tests across `profile-parser.spec.ts` and
`profile-import.service.spec.ts`, all against synthetic PDFs constructed to
resemble a LinkedIn export. **No genuine LinkedIn PDF has ever been run through
it.**

Two real defects were found and fixed by testing against realistic *shapes* —
the two-column layout welding a sidebar skill to a body heading (producing the
skill "SQL Summary"), and a contact line being taken as the headline. Both were
found by constructing the awkward case, not by receiving one.

The risk is that LinkedIn's actual export differs in ways nobody predicted, and
parsing is heuristic enough that this is likely rather than possible.

**Mitigating factor:** ADR-008 means a parse never saves silently — it prefills
a form the person confirms. A bad parse is visible and correctable before
anything is stored. That is the design working as intended.

**Resolution.** Export one real LinkedIn profile as PDF and run it. Half an
hour of work that has not been done because it needs a real account.

---

<a id="ki-03"></a>
## KI-03 — Approving an application confirms the deal · Medium

Approving an employer's application to attend also sets their pipeline stage to
`confirmed` (ADR-007). This is deliberate and documented: without it, an
approved employer could not be seated on the floor plan, and the demo's main
path dead-ended.

**It is wrong for production.** A deal is confirmed when it is signed, not when
an application is accepted. They should be decoupled, with the floor plan
seating on a different criterion — attendance approved, rather than commercially
confirmed.

---

<a id="ki-07"></a>
## KI-07 — Skill matching barely visible in the demo · Low

The Jobs tab marks roles overlapping the viewer's profile skills. The seeded job
seeker is an electrical engineering student, and only **2 of fair-01's 87
roles** overlap. The feature is correct; the demo underplays it.

**Resolution.** Broaden the seeded candidate's skills. Explicitly *not* to
loosen the matching rule — that would make the feature look better by making it
worse.

---

<a id="ki-08"></a>
## KI-08 — No deployment or operations documentation · Low

There is no Deployment Plan, Runbook or Incident Response process, and those
gaps are honest: deployment is a static publish to Netlify with no server, no
database, no migration and no rollback complexity. A runbook whose only entry
is "push to main" would be ceremony.

**This changes the moment Laravel exists.** At that point a Deployment Plan
(with migration and rollback steps) and a Runbook become genuinely necessary
and should be added as documents 08 and 09 in this set.

---

<a id="ki-09"></a>
## KI-09 — `Live` chip borrows warning semantics · Low

`Live` is the only status chip rendered as a solid fill, in amber. This is
deliberate — `--fo-accent` fails contrast as text at 2.1:1 on white, so it is
used as a background with ink on top, and the reasoning is in
`status-chip.component.ts`.

The cost is that amber conventionally reads *warning*, while Live is the
healthy state. Beside teal outlined `Open` chips it can read as a fair in
trouble. Raised as a cosmetic finding in `docs/10` and not in the approved fix
set.

**Resolution.** Keep the accent, change its role: tinted accent background,
accent-dark text, and a small filled dot rather than the `sensors` icon.

---

## 2. Environment constraints a maintainer will hit

Not defects — properties of the development setup that waste time if unknown.

| Constraint | Detail |
|---|---|
| **Node version** | Angular 22 requires Node ≥ 22.22.3 and hard-fails below it. The cloud VM ships 22.22.2 — one patch short. A SessionStart hook installs the newest 22.x; check `node -v` at the start of a session. |
| **npm version** | npm 10 cannot install this dependency graph (`Cannot read properties of null (reading 'edgesOut')` — an arborist peer-resolution bug hit by vitest's peers). **Use `npm ci`**, which reifies from the lockfile and is unaffected. Only `npm install` needs npm ≥ 11. |
| **No localhost** | The developer cannot view `localhost`. Verify with `npm run build`, the test suite, and headless Chromium; review through the Netlify deploy preview. |
| **Network** | Trusted allowlist only: npm registry, GitHub, Google Fonts. Most other domains are blocked. |
| **Non-interactive** | Every command must run without prompting. Find the flag rather than piping an answer. |
| **pdf.js worker MIME** | The module worker must be served with a JavaScript MIME type, pinned in `netlify.toml`, cached `max-age=3600, must-revalidate` — **not** immutable, because the filename carries no content hash. |

---

## 3. Traps in the code itself

Each of these cost real time at least once.

| Trap | What happens | Avoid by |
|---|---|---|
| **Shared random stream in the seed** | Adding a generator shifts every number drawn after it. Adding two fairs once dropped a fair's booth fill from 40% to 1/40. | Give each new seed generator its own `SeededRandom` instance. |
| **Material CSS injected at runtime** | It lands after `styles.scss`, so a global helper tying at equal specificity loses on source order — silently. | Qualify the helper with the Material class it sits on. |
| **Material's `::before` is a flex item** | `.mat-mdc-dialog-title::before` (width 0, height 40px) becomes a flex child. `space-between` then centres the title; a `gap` indents it. | Use `flex-start` and no gap on dialog headers. |
| **Angular collapses template whitespace** | Adjacent inline spans render with no space between them, producing `RM3,500–4,700/ month`. | Use flex with a gap — layout, not content. |
| **`expectOne(string)` matches `urlWithParams`** | A request carrying query params silently fails to match; `verify()` then throws and leaves the TestBed instantiated, making *unrelated* spec files fail with a misleading message. | Use a predicate matcher for any request with parameters. |
| **`page.goto` reseeds the mock database** | A full page load rebuilds the in-memory DB, so a write made before it appears to have been lost. | Verify multi-step flows with in-app navigation. |
| **Zoneless signal inputs in tests** | Setting a plain host field does not drive a signal input. | Drive it with a `signal()` in the host component. |
| **The mock database is module state** | It persists across tests in a file, so one test's write changes the next test's fixture. A shortlist made by one routing test silently unlocked contact details for the next. | `resetMockDb()` in `beforeEach` for any spec driving the real app. |
| **`per_page` is capped at 100** | Asking for 500 returns 100 with no error, so a test that assumes it got everything asserts against an arbitrary first page. | Page through using `meta.lastPage`. |
| **`tsc --noEmit` is not the build** | It passes where `ng build` fails, because it does not compile templates. | Verify with `npm run build`. |

---

## 4. If you are taking this over

**Read in this order:** `README.md` → `CLAUDE.md` → this document set →
`docs/diagrams/` → the phase plans in `docs/01`–`docs/11` for the reasoning
behind anything that looks odd.

**Before changing anything,** run `npm ci && npm test -- --watch=false && npm run lint && npm run build`
and confirm 401 tests pass and the bundle is under 650 kB. That is the baseline.

**The three rules that are easiest to break accidentally:**

1. Never use a Tailwind utility to fight a Material internal (ADR-002).
2. Field-level protection is enforced server-side, never in a template (ADR-010).
3. A passing test suite is not verification — open the page.

**Highest-value work, in order:** the Laravel backend the API contract in
SRS §5.1 was designed for, then KI-05, then KI-02. V1 (KI-04) is done.
