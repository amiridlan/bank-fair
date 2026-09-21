# 07 — UI/UX Refresh Plan (Tailwind v4)

Follows `docs/06-build-plan.md`. Same working rules: one phase = one cloud session = one branch = one PR, and each phase ends with the standard summary described in `CLAUDE.md`.

The goal is not a restyle. It is to fix the usability problems found in the review below **and** move layout and rhythm onto Tailwind, without regressing the accessibility work Phases 6 and 7 paid for.

---

## Locked decisions

Agreed before T1. Later sessions start with fresh context, so they are recorded here rather than left in a chat thread.

| # | Decision | Why |
|---|---|---|
| **T-D1** | **Tailwind v4**, not v3 | v4's `@theme` block *is* CSS custom properties, so `src/styles/_tokens.scss` stays the single source of truth. v3 would restate every token in `tailwind.config.js` — two sources for the same values, which is the drift `CLAUDE.md` forbids. This overrides the project owner's usual v3 default, deliberately. |
| **T-D2** | **Split ownership.** Tailwind owns layout, spacing, grid and typography on app-owned markup. Angular Material keeps owning its own components, themed through `mat.theme()` and token overrides. | Tailwind v4 emits everything inside `@layer`; Material's styles are unlayered, and unlayered always beats layered. A utility class on a `matButton` silently does nothing. Phase 7's top-bar contrast fix already learned this the hard way. |
| **T-D3** | **Never use a utility to fight a Material internal.** No `!important` modifiers, no layering Material to win specificity. If a Material component needs to look different, theme it through Material's own tokens or style the elements the component itself owns. | Keeps the cascade predictable. See the comment in `role-switcher.component.scss`. |
| **T-D4** | **Nothing below ramp step 500 may carry text or act as a functional boundary.** | `--fo-border-strong` shipped at 1.48:1 once (Phase 6). Encoding the rule stops it recurring. |

### New dependencies

Approved by the project owner, per `CLAUDE.md`'s rule about asking first. All devDependencies; nothing reaches the browser but generated CSS.

- `tailwindcss@^4`
- `@tailwindcss/postcss`
- `postcss`

---

## Evidence basis

Heuristic evaluation (Nielsen's ten) against rendered screenshots of all six main screens at 1440×1000 with real seed data, plus the axe/CSP harness. **No user research exists for this product.** Everything in the review is expert judgement, not observed behaviour — hold it loosely against anything a real organiser does. The cheapest test that would confirm or kill most of it is watching one person attempt the demo script's tasks without help.

### Correction carried forward from Phase 7

The Phase 7 audit reported "0 violations across 10 pages, both roles". The staff rows were genuine; **the four hiring rows were not.** The harness switched role by clicking the menu, then navigated with `page.goto()` — a full page load, which resets the demo identity, so the role guard bounced each one back to `/staff/dashboard`. It audited the staff dashboard four times and passed.

Re-run with in-app navigation, the hiring pages do pass (Talent pool, Shortlist, Interviews, Candidate — 0 violations, 0 CSP violations). The result stands; the verification did not exist when it was claimed. The underlying cause is a real defect, logged as **UX-2**.

---

## Usability review

### Critical

**UX-1 · The pipeline board hides two of its five columns.**
At 1440px the board shows Lead, Proposal, Confirmed and half of Paid. **Lost is entirely off-screen with no scroll affordance** — no shadow, no peek, no arrow.
*Heuristic: visibility of system status.* A user who does not think to scroll horizontally concludes the pipeline has four stages.
**Fix:** narrow the columns, collapse Lost into a compact terminal rail, add an edge-fade so the overflow is visible. Add per-column RM totals to the headers — the board currently cannot answer "what is in Proposal?" without manual addition.

### Major

**UX-2 · The demo identity does not survive a refresh or a shared link.**
`AuthStore` holds the current user in a plain signal. Refreshing on `/hiring/talent-pool`, or opening a link someone sent, silently bounces to the staff dashboard.
*Heuristic: user control and freedom.* It broke the Phase 7 audit; it will break a demo viewer the same way.
**Fix:** persist the demo user id to `sessionStorage`, rehydrate on boot. Keep the **DEMO ONLY** comment — this is still not authentication, and Sanctum replaces it in R2.

**UX-3 · Talent-pool rows are ragged and unscannable.**
Names wrap to two lines, universities to two, skills chips to two rows — row heights vary between roughly 48px and 96px with no pattern. Scanning 300 candidates by CGPA or graduation year gives the eye no rhythm to follow.
*Heuristic: aesthetic and minimalist design.*
**Fix:** fixed row height, single-line truncation with a `title`, skills capped at two chips plus an overflow count.

**UX-4 · No inline shortlist action.**
Shortlisting requires opening the drawer and closing it again, per candidate. The core hiring-manager task is triaging a long list, and the design makes it a three-step round trip each time.
*Heuristic: flexibility and efficiency of use.*
**Fix:** a bookmark toggle in each row. The drawer stays for "tell me more", not for the primary action.

**UX-5 · Two filter labels truncate to nonsense.**
"Gradua…" and "Min CG…" — the selects are narrower than their own labels.
*Heuristic: match between system and the real world.*
**Fix:** shorten the labels and widen the fields, or move to a filter bar that wraps rather than compresses.

**UX-6 · The interview grid does not say which day.**
`fair-01` runs 21–22/09/2026, but the slot grid shows one unlabelled day with no date and no day switcher. A hiring manager cannot tell which day they are booking.
*Heuristic: visibility of system status.*
**Fix:** day tabs for multi-day fairs with the date in the header. Mark 12:00–13:00 as a break rather than rendering it as bookable like any other slot.

### Minor

**UX-7 · KPI cards do not align.** "Active fairs" has no delta line, so it is shorter than its neighbours and the row's bottom edge is ragged. Reserve the delta line's height, or bottom-align the row.

**UX-8 · Pipeline cards bury the number.** Deal value renders at the same weight as the industry. On a sales board the money should read first after the name.

**UX-9 · "No package yet" on every Lead card.** It is the definitional state of a lead — pure repetition down the column. Show it from Proposal onward, where its absence is actionable.

**UX-10 · Nothing signals that a talent-pool row is clickable.** Add a trailing chevron.

### Working well — must not regress

The four-state discipline (loading / empty / error + retry / loaded) is applied consistently. Status is never carried by colour alone. Every drag has a keyboard path through the same code. Contrast is measured rather than assumed. **Each phase re-runs the axe and CSP audit before pushing.**

---

## Visual direction

### Operations console, not SaaS dashboard

**Why it fits.** Staff work a floor plan and a pipeline all day; hiring managers triage 300 people against a clock. Density is a feature here. The generic default — bento cards, soft shadows, an indigo gradient, Inter everywhere — optimises for a page that gets looked at, not a tool that gets used.

**What it signals.** Swiss/International style: rigid grid, objective hierarchy, restraint. Credible and precise, which is the right register for software whose job is to not lose someone's booth booking.

**Where it fails.** It reads cold, and can tip into sterile. The counterweight is warmth in the micro-detail — the existing amber "Live" accent, and generous line-height in prose set against tight data density.

**Lifecycle.** Swiss is not a trend and cannot date. That is the point, and also why it needs one deliberate move to avoid reading as a default admin theme.

### The conviction move: a monospace numeric spine

Every identifier and number renders in IBM Plex Mono — booth codes, slot times, CGPA, RM values, counts. `--fo-font-mono` and `.fo-tabular` already exist but are applied inconsistently. Applied systematically, columns align optically, the floor plan reads like a seating chart, and the app gains a signature that no amount of teal provides.

### Palette — extend, do not replace

The existing tokens are measured, and `--fo-border-strong` was caught at 1.48:1 once already. They are not being re-rolled. What is missing is intermediate steps, which is why components reach for hard-coded tints.

Ramps below were computed and every pairing verified, not asserted.

```
teal, hue 175                 vs white   role
 50  #f3fcfb                    1.04     subtle fills
100  #e3f7f5                    1.11
200  #c3eae7                    1.29     borders on teal surfaces
300  #88d3cd                    1.71
400  #3bb0a6                    2.64     disabled, placeholder
500  #1f847c                    4.52     ← lowest step usable for text
600  #176e67                    6.06     primary buttons, links
700  #115a54                    8.03     hover, active
800  #0f433f                   11.08
900  #0c2c2a                   14.90

slate, hue 222 (tinted toward ink, not neutral grey)
 50  #f8f9fc                    1.05     page surface
200  #dee2ed                    1.30     hairline borders
400  #8b96b1                    2.96     ← fails 3:1, decorative only
500  #5b6b8f                    5.32     strong borders
700  #323f5d                   10.48     secondary text
900  #172036                   16.20     headings
```

The existing anchors sit inside these ramps and stay: `--fo-primary` `#0f766e` (5.47:1) between teal-500 and 600; `--fo-border-strong` `#64748b` (4.76:1) at slate-500 — which the ramp independently validates; `--fo-ink` `#14213d` (15.97:1) at slate-900.

**T-D4 falls straight out of this table** and belongs in `docs/03-design-system.md` as a rule, not a note.

### Type scale — 1.2 (minor third), compressed at the small end

Current sizes (12 / 14 / 18 / 24 / 32) approximate a 1.25 ratio but drift. A clean 1.2 from a 14px body — the right ratio for information-dense UI — gives **12 / 14 / 17 / 20 / 24 / 29 / 35**. Line height moves inversely: 1.55 body, 1.35 subhead, 1.15 display.

Typefaces stay: Plus Jakarta Sans (display) + IBM Plex Sans (body) + IBM Plex Mono. Geometric display against humanist body, with the mono from the body's own superfamily — the pairing is already sound.

### Spacing, radius, motion

Unchanged. The 4px base (`4 8 12 16 24 32 48 64`) is right; radius stays 4/6px (the forgettable choice is 8px on everything, already avoided); motion tokens and the `prefers-reduced-motion` collapse stay as they are.

---

## Phases

Each ends with `npm run build`, `npm test -- --watch=false`, `npm run lint`, and the axe + CSP audit — all green before pushing.

### T1 — Install, and prove the boundary

Tailwind v4 through PostCSS. Feed `@theme` from `_tokens.scss` rather than restating values. Scope Preflight so it does not flatten Material's typography. Extend `_tokens.scss` with the ramps above. Add T-D2/T-D3/T-D4 to `CLAUDE.md` and `docs/03-design-system.md`.

Convert **one screen only** — the Dashboard — end to end, as proof the boundary holds. Measure the CSS delta.

*Risk: low.* One screen, trivially revertible.

### T2 — The critical and load-bearing fixes

UX-1 (pipeline overflow, Lost rail, column totals) and UX-2 (persist the demo identity). Both are behavioural, independent of styling, and worth shipping before the cosmetic work.

*Risk: low.*

### T3 — Tables and lists

UX-3, UX-4, UX-5, UX-10 across talent pool, shortlist and the fair employers tab. Apply the monospace numeric spine.

*Risk: medium* — the candidate drawer and the 409-on-duplicate-shortlist path both need re-testing.

### T4 — Boards and grids

Employer kanban, floor plan, interview grid (UX-6, UX-8, UX-9).

*Risk: highest.* CDK drag-and-drop styling is delicate — `cdk-drag-preview`, `cdk-drag-placeholder` and the drop-list classes must keep working, and **both the drag and the keyboard path need re-verification**, not just the drag.

### T5 — Shell, charts, sweep

Top bar, side nav, KPI cards (UX-7), chart card layout. Delete the SCSS the refresh has made dead. Full audit, re-measured bundle, updated README.

*Risk: low.*

---

## Scope and budget

**Stylesheet surface:** 23 `.scss` files totalling 1,603 lines, plus 14 components with inline `styles:` blocks. T1–T5 does **not** delete all of it — component-internal Material theming stays in SCSS by design (T-D2). Expect roughly half to go.

**Bundle:** global CSS is 13.2kB today. Tailwind's output for an app this size should land around 10–25kB raw. The 650kB initial budget is not at risk, but T1 measures rather than assumes.

---

## Facts discovered during the refresh

### T1

- **Tailwind's entry point cannot be an `.scss` file.** Sass resolves `@import` itself and tries to load `"tailwindcss"` as a Sass module. The entry is `src/tailwind.css`, plain CSS, listed before `styles.scss` in `angular.json`; Angular runs PostCSS over it via `.postcssrc.json` and concatenates the results.
- **Unlayered CSS beat our own element rules too, not just Material's.** An `h1` rule in `styles.scss` outranks `class="text-display"` on that `h1`, because the rule is unlayered and the utility is not — the same mechanism as the Material problem, pointed the other way. Element defaults now live in a `fo-base` layer declared between `components` and `utilities`. Verified: the panel headings compute to 20px (`text-h2`) rather than the 18px the `h2` rule sets, while keeping the brand font the `h2` rule gives them.
- **Preflight is safe precisely because it is layered.** Its `button`, `table` and heading resets sit in `@layer base`, so Material's unlayered styles beat them automatically. No scoping or disabling was needed.
- **`--color-*: initial` genuinely removes Tailwind's default palette.** Verified through the real build, not assumed: a template using `bg-blue-500 text-red-600 rounded-lg text-xl` produced **no** CSS for any of them, while `text-h2` and `rounded-md` were emitted. The same reset is applied to `--text-*` and `--radius-*`. CLAUDE.md's "no hard-coded hex values" is now enforced by the toolchain rather than by review.
- **Theme variables are tree-shaken.** `@theme` only emits the custom properties that generated utilities actually reference, so an unused token costs nothing. A grep of the built CSS for a token you just added will come back empty until something uses it — that is not a bug.
- **UX-7's cause was the host element, not the card.** `.kpis` is a grid and grid items stretch by default, but the grid item is `<app-kpi-card>`, whose host had no height, so the inner `<article>` sized to content. Fixed with `host: { class: 'block h-full' }`. Measured after: all four cards 114px with bottoms at y=284 on desktop, and equal per row at tablet width. At mobile width the cards differ, correctly — one per row, nothing to align with.
- **The audit harness had been lying about the hiring pages.** It switched role by clicking, then used `page.goto()`, which reloads and resets the client-side identity, so the guard redirected all four to `/staff/dashboard` and they passed as the dashboard. The harness now switches once and navigates inside the SPA, prints the URL it actually audited on every row, and reports `SKIP … NOT AUDITED` rather than `PASS` if a page redirects. Re-run: 11 pages, 0 violations, 0 CSP violations, each row showing the URL it checked.
- **Cost so far:** global CSS 13.2 kB → 24.4 kB raw (4.03 → 5.08 kB transferred); initial total 624.41 kB → 635.61 kB, inside the 650 kB warning budget. Roughly 9 kB of that is Preflight plus the theme block and is a one-off; later phases add utilities, not another baseline.

### T2

- **The Lost rail could not be 150px.** Measured, not guessed: an employer card's overflow-menu button carries a 48px Material touch target, and at 150px it pushed **31px past the column edge**. Every column now has the same 200px minimum; Lost simply does not grow into the spare room. Result at 1440px: five columns at 222/222/222/222/200, the last ending exactly at the board's right edge, with nothing overflowing.
- **Narrower columns cost card density.** Columns went 280px → 222px so all five fit, and long employer names now wrap to three or four lines instead of two. That is a deliberate trade — a whole invisible column is Critical, card density is Minor — and T4 reworks the card anyway (UX-8).
- **A one-shot render hook measures nothing here.** The board element lives inside the loaded branch, so it does not exist when `afterNextRender` fires and the fade never appeared. `afterRenderEffect` depending on `store.byStage()` re-measures when the element arrives and whenever a search changes how many cards there are.
- **`ResizeObserver` is not defined in jsdom**, and a field initializer constructing one took the whole board down in tests. Replaced with the CDK's `ViewportRuler`: the board only changes width when the viewport does, the CDK is already a dependency, and it works under jsdom — so the fade degrades rather than the page failing.
- **Persistence made a latent test-isolation bug visible.** `sessionStorage` outlives a `TestBed`, so one test's `switchUser` leaked into the next and two assertions failed. The specs now clear storage in `beforeEach`. The tests were right to catch it — the shared state is real.
- **Verified in a browser, not just in jsdom:** drag Lead → Proposal moves the card (15/12 → 14/13); the card menu's Move to Confirmed moves it again (13/10 → 12/11); totals shift with a valued move (Proposal 79,500 → 76,000, Confirmed 64,000 → 67,500); a reload on `/staff/employers` as Daniel Lim keeps the identity and redirects to `/hiring/talent-pool`; `/hiring/interviews` opens directly from a pasted URL; and a fresh tab still starts as staff, because `sessionStorage` is per-tab.
- **Cost:** initial total 635.61 kB → 637.21 kB.
