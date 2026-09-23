# 10 — UI/UX review

A heuristic review of BankFair as it stands after S1–S4 and A1–A3, plus the
visual direction for the fixes.

The findings were written and agreed **before any code changed**, so they can
be argued with on their own terms. "What was built" at the end records what was
then done, what the implementation turned up that the review had missed, and
what was deliberately left alone.

## Evidence basis — read this first

There is no user research for this project. No analytics, no support tickets,
no session recordings, nobody has used it but the person building it. So this
review sits on **rung 5 of the evidence ladder: expert heuristic evaluation**,
with some rung 4 (comparative judgement against how other admin portals solve
the same problems).

That means it can find *real defects* — a phantom 196px indent is a defect
whether or not a user has complained about it — but it **cannot tell you what
users want**. Anything here about what an organiser would rather see on the
fair Overview tab is an assumption, and is labelled as one.

Measurements were taken in Chromium at 1440×1000 against the production build,
not read off a design. Where a number comes from a screenshot rather than a
live `getBoundingClientRect()`, it says so.

## Verdict: not an overhaul

The offer was open to one. It is not warranted, and taking it would be the
wrong call:

- `docs/07-ui-refresh-plan.md` already ran a full visual refresh (T1–T5) with
  its own usability pass. The token system, the four-state discipline, and the
  status-chip contract are sound and worth keeping.
- The problems below are **not systemic taste failures**. They are a handful of
  specific, locatable bugs and two genuine layout gaps. A redesign would throw
  away working parts to fix them, and would re-open accessibility work that is
  currently passing.

What is warranted: **six targeted fixes**, one of which (the fair Overview tab)
is a content decision rather than a styling one.

---

## Findings

### Critical

None. Nothing in the app blocks task completion or loses data. Saying so is the
point — a review that marks everything critical gets ignored.

### Major

**1. Dialog titles are indented 196px by a Material internal.**
*Heuristic 4 — consistency and standards.*

`.head` sets `display: flex; justify-content: space-between` on the element
carrying `mat-dialog-title`. Material's own `.mat-mdc-dialog-title::before`
(`display: block; width: 0; height: 40px`) then becomes a **zero-width flex
item**, so `space-between` distributes free space *around* the title instead of
pushing it to the left edge.

Measured live on the registration dialog: the dialog's content box starts at
x=364 (340 + 24px padding); the `<h2>` starts at **x=559.78**. The title looks
centred, and is not centred — it sits 196px in, 19px left of true centre. Both
dialogs have it.

**Impact:** every user, every dialog. It is why both modals read as
"floating dialog box" rather than as part of the app — every other heading in
BankFair is flush left.

This is the exact hazard CLAUDE.md warns about ("never fight a Material
internal"). Here the internal fought back silently.

**Fix:** don't touch the pseudo-element. Change the flex so it cannot matter:

```scss
.head {
  justify-content: flex-start; // not space-between
}
.head__title { flex: 1 1 auto; }
```

**2. The two dialogs use opposite action layouts.**
*Heuristic 4 — consistency and standards.*

| | Registration dialog | Candidate dialog |
|---|---|---|
| Footer direction | `row`, right-aligned | `column`, `align-items: stretch` |
| Primary button | ~105px, right edge | **686px of a 720px dialog** (screenshot, 1440×1000) |
| Section labels | `THIS APPLICATION` (uppercase, 0.06em tracking) | `Skills` (sentence case) |

Same app, same dialog role, three contradictions. The full-bleed
`Add to shortlist` is also the single heaviest element on that screen — heavier
than the candidate's own name, which is what the user actually came to read.

**Impact:** employers and staff both. Low severity per instance, but it is the
kind of inconsistency that makes a product feel assembled rather than designed.

**Fix:** one footer contract for both — `flex-direction: row`,
`justify-content: flex-end`, buttons at their natural width, note field moved up
into `mat-dialog-content` where it belongs (it is input, not an action). Section
labels sentence case in both.

**3. The fair Overview tab is 68% empty.**
*Heuristic 8 inverted — minimalism has become emptiness.*

Measured live at `/staff/fairs/fair-01`, 1440×1000: the last pixel of content is
at **y=317**. 683px — over two thirds of the viewport — is blank. The tab
contains one 80px strip of four figures and nothing else.

**Impact:** staff, on the page they open most. An empty screen does not read as
"clean", it reads as "still loading" or "broken", and the Floor plan / Employers
tabs next to it are full.

**Fix — two options, first recommended:**
- **(a)** Give Overview something to be: booth fill as a progress bar rather
  than `26/40 (65%)` text, the fair's pending registrations with inline
  approve/turn-down, and the recent activity entries for that fair (A3 already
  records them). This makes Overview the fair's home rather than a stat line.
- **(b)** Delete the Overview tab and land on Floor plan. Cheaper, honest, and
  loses the at-a-glance figures.

*Assumption:* that an organiser opening a fair wants pending registrations
first. Unvalidated — the cheapest test is asking one organiser what they check
when a fair is live.

**4. The dashboard has the same problem, smaller.**
*Heuristic 8.*

Four KPIs and two charts end around y=645; roughly 350px below is empty. The two
charts sit side by side in the top half and nothing uses the bottom.

**Fix:** a third panel — registrations over time, or the recent-activity feed
from A3 — or reflow to let the charts take the height they deserve. Same
assumption caveat as above.

### Minor

**5. Card actions don't bottom-align across a row.**
*Heuristic 4.*

On `/me/fairs`, two cards in the same grid row: `Register` sits at y≈367,
`Withdraw` at y≈397, because one card carries a registration-state line and the
other doesn't. The grid stretches the cards to equal height but the action
wrapper is not pushed to the bottom.

**Fix:** `mt-auto` on the action `<div>` in `seeker-fairs-page.component.html`
and `employer-fairs-page.component.html`. One class each.

**6. The talent pool truncates the columns people filter on.**
*Heuristic 6 — recognition over recall.*

`Skills` shows `MATLAB, Signal …` and `University` shows
`Monash University M…`. Skills is the column an employer scans; it is the one
cut shortest.

**Correction — the first version of this finding was wrong twice.** It proposed
chips plus `+N`, and it proposed freeing width by dropping a `Qualification`
column. There is no `Qualification` column in that table (it appears in the
candidate dialog, not the list), and chips there were already tried and
rejected on measured evidence: docs/07 UX-3 records that they wrapped to a
second row, took rows to 96px, and left about 70px of text per chip so they
read `M…` and `Signal…`. Repeating a rejected experiment is worse than leaving
the column alone.

**The actual cause** is that the column widths still budget for a layout that
no longer exists. They were tuned when the candidate profile was a drawer
taking half the row, so every column was sized against roughly 600px. The
profile is a modal now and the table always has the full width — but `Skills`
was left on 15% while the year and the actions kept width they have no content
for.

**Fix:** rebalance the percentages. `Skills` 15% → 21%, taken from `fullName`,
`fieldOfStudy`, `graduationYear`, `cgpa` and `actions`, with the year and CGPA
keeping enough to stay whole at the table's 960px floor.

**7. `THE EMPLOYER` / `THIS APPLICATION` are stilted.**
*Microcopy.*

Definite articles in section headings read like form scaffolding. `Application`
and `Employer` say the same thing without the throat-clearing — or
`About this employer` if a full phrase is wanted.

**8. Interview slots waste their cards.**
*Heuristic 8.*

Each slot is ~230×95px carrying a time, a name and a status — roughly 40px of
content in a 95px box. 21 slots run to five rows and push the day's afternoon
below the fold on a laptop.

**Fix:** `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` and drop
the card padding a step. Fits the whole day above the fold.

### Cosmetic

**9. `Live` is the only chip that is a solid fill, in amber.**

This is deliberate — `--fo-accent` fails as text at 2.1:1 on white, so it is
used as a background with `--fo-ink` on top, which is documented in
`status-chip.component.ts`. The cost is real though: amber conventionally reads
*warning*, and Live is the healthy state. Next to teal outlined `Open` chips it
looks like the fair is in trouble.

**Fix (optional):** keep accent, change its role — tinted accent background,
accent-dark text, and a small filled dot instead of the `sensors` icon. Stays
the loudest chip without borrowing warning semantics.

**10. Dates are set in monospace.**
`fo-tabular font-mono` on `23/09/2026` gets the alignment but also gets the
code-listing texture. If the body face has tabular figures,
`font-variant-numeric: tabular-nums` gets the alignment without the texture.
Worth checking before changing — alignment matters more than texture in the
interview grid.

### Working well — keep these

Not courtesy items; these are load-bearing and a refactor should not disturb
them.

- **Page headers that state consequence.** "Approving one puts them on its floor
  plan" tells the user what the button *does to the world*. Most admin portals
  write "Manage registrations" here and teach nothing.
- **Four states everywhere.** Loading, empty, error-with-retry, loaded — applied
  without exception. This is the single most valuable thing in the codebase and
  is rarer in shipped products than it should be.
- **Status never carried by colour alone.** Every chip has an icon and a label.
- **The masked-contact lockbox.** It shows the mask *and* names the action that
  unlocks it. Most implementations show a blank and let the user guess.
- **Rejection reasons shown to the employer.** Being told no without being told
  why leaves nothing to act on; the app gets this right.
- **The registration dialog's partial-failure copy.** "Couldn't load this
  employer's record. The application details above are still correct." — that is
  a genuinely good error message: what failed, and what is still trustworthy.

---

## Visual direction

### The direction it is already in, named

BankFair is **restrained institutional** — flat surfaces, 1px borders instead of
shadows, a single deep-navy chrome bar, teal as the only saturated accent. It
fits: the audience is an operations team looking at the same screens for eight
hours, and the goal is accuracy, not delight.

**What it signals:** competence and neutrality. Banking-adjacent, which the name
invites.

**Where it fails:** it is one decision away from the default admin template.
Deep navy chrome + teal accent + white cards + 6px radius is the house style
that appears when no decision is made. Right now BankFair would not be
recognisable with the wordmark removed.

### The one conviction choice

Not a repaint. **Give the data typography a real voice.** This is an operations
portal — the numbers are the product. Currently every figure is either body text
or monospace, and monospace is doing the work that lining tabular figures should
do.

Concretely:

- Promote figures to a distinct display treatment at the KPI/stat level:
  32px/600, tabular, `-0.02em` tracking, `--fo-ink`, with the unit (`RM`, `%`)
  at 0.6em and `--fo-text-muted`. The dashboard already half-does this; make it
  a token, `--fo-figure-*`, and use it on the fair stat strip and the interview
  counts too.
- Retire `font-mono` from dates and money. Keep `font-variant-numeric:
  tabular-nums` for alignment.

That one move is more distinctive than any palette change, and it is the choice
that matches what the app is *for*.

### Seven-dimension critique

| Dimension | Verdict |
|---|---|
| **Clarity** | Strong. Every page says what it is and what the next action is. |
| **Hierarchy** | Weakest dimension. Squint at the candidate dialog and the 686px button reads first, the name second. Squint at the fair Overview and nothing reads at all. Findings 2, 3, 4. |
| **Consistency** | Good at the token level, broken at the component level — two dialogs, two footers, two label cases. Finding 2. |
| **Appropriateness** | Correct. Restrained is right for eight-hour operational use. |
| **Craft** | Two real defects: the 196px phantom indent (1) and the ragged card actions (5). Otherwise clean — spacing follows the scale, the border-not-shadow rule is held everywhere. |
| **Distinctiveness** | Low, by the standard above. The figure treatment is the fix. |
| **Accessibility** | Best dimension. Contrast passes, focus states visible, status never colour-only, `scrollable-region-focusable` already handled, skip link present, 44px targets. Nothing to fix here. |

---

## Proposed work

Six fixes, ordered by value per unit of risk. Roughly one session.

| # | Change | Files | Risk |
|---|---|---|---|
| 1 | Unify the dialog header — kill the 196px indent | both `*-dialog.component.scss` | none |
| 2 | Unify the dialog footer; note field into content; sentence-case labels | both dialogs | low — snapshot-free tests |
| 3 | `mt-auto` on card actions | 2 templates | none |
| 4 | Talent pool: skills as chips, drop `Qualification` | talent pool table | low |
| 5 | `--fo-figure-*` token + apply to KPIs, fair stats, interview counts | `_tokens.scss` + 3 templates | low |
| 6 | Fair Overview: booth-fill bar, pending registrations, recent activity | fair overview tab | **medium — new content, needs the decision in finding 3 first** |

Items 1–5 are safe to do now. **Item 6 needs a decision** (option a or b) before
any code moves.

---

## What was built

All six items, plus the two defects the work itself uncovered. Verified in
Chromium at 1440x1000 and 390x844, with axe-core clean at both widths on every
changed surface.

| # | Change | Result |
|---|---|---|
| 1 | Shared dialog header | Title at x=364 = dialog edge + its 24px padding. The 196px indent is gone, exactly. |
| 2 | Shared dialog footer, note field moved into the content | `Add to shortlist` 686px -> **156px**, right-aligned. Both dialogs now row/flex-end with a rule above. Section labels sentence case in both. |
| 3 | `mt-auto` on card actions | Seeker fair cards: buttons were at y=367 and y=397 in the same row, now both at y=415. |
| 4 | Talent pool column rebalance | `Skills` 180px -> 238px, showing six skills where it showed one and a half. Row height still 56px, so docs/07 UX-3 holds. |
| 5 | `.fo-figure` / `.fo-figure--sm` / `.fo-figure__unit` | One named treatment; the KPI card's six-utility stack and the fair stat strip now share it. |
| 6 | Fair Overview given content | Last content pixel y=317 -> **y=708**. Stat strip, booth-fill and check-in meters, this fair's pending queue with inline decisions, recent decisions scoped by a join on the fair's application ids. |

### Two things the implementation found that the review had not

**Material's component CSS is injected at runtime, so it lands after
`styles.scss`.** The shared `.fo-dialog-head` and `.fo-dialog-foot` tie with
`.mat-mdc-dialog-title` / `.mat-mdc-dialog-actions` at 0-1-0 specificity and
therefore *lost on source order* — silently. The header stayed `display:
block`, which dropped the close button onto its own line under the title. Both
are now qualified with the Material class they sit on
(`.mat-mdc-dialog-title.fo-dialog-head`), which wins on specificity rather than
on an order that is not ours to control. This is the same hazard as finding 1,
one layer down: CLAUDE.md's rule about not fighting Material internals has a
corollary — *cooperating* with one still needs the specificity checked rather
than assumed.

**The pseudo-element is a flex item, so `gap` applies to it too.** After the
`flex-start` fix the title sat at x=376, not 364 — a 12px `gap` between the
zero-width `::before` and the title. The same phantom indent in miniature. The
container now has `gap: 0` and the close button is pushed out by the title's
own `flex: 1 1 auto`.

### Deliberately not done

- **Retiring `font-mono` from dates and money** (cosmetic finding 10). It is a
  system-wide decision recorded in docs/07, not a local one, and item 5 as
  approved was the figure token rather than the mono retirement.
- **Re-colouring the `Live` chip** (cosmetic finding 9). Still worth doing; it
  was not in the approved set.

## What would change this review

The load-bearing assumption is that **staff open a fair to act on it, not to
read it**. Everything recommended for the Overview tab depends on that. If an
organiser actually opens a fair to check numbers before a meeting, the current
stat strip is right and only needs company — the pending-registrations panel
would be noise.

Cheapest test: ask one career-fair organiser, "when you open a live fair on a
Monday morning, what are you checking?" One answer settles finding 3.
