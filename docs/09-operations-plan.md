# 09 — Operations: Audit Log, Loading Feedback, Settings

Follows `docs/08-self-service-plan.md`. Same working rules: one phase = one session = one branch, and each phase ends with the standard summary described in `CLAUDE.md`.

Three requests from the developer, taken in an order set by their dependencies: A3 puts the Activity log inside Settings, so A2 has to exist first.

---

## Locked decisions

| # | Decision | Why |
|---|---|---|
| **L1** | **Every role's writes are logged; only staff can read the log.** | The ask was "which staff edits anything", but a booth reassignment or a withdrawn registration is worth tracing whoever did it, and scoping the *recording* by role would leave holes exactly where a demo is most likely to be questioned. Reading stays staff-only, like every other staff surface. |
| **L2** | **`from → to` for business fields; for name, email and phone, record only that the field changed.** | An audit log is a second store of whatever it copies. Recording a job seeker's old and new phone number duplicates the personal data the masking rules exist to contain, and it would then need its own retention rule. The enforcement lives at the recording layer, not the view — a component cannot leak what was never written. |
| **L3** | **Settings at the bottom of the nav for all three roles; Activity is a section inside staff's Settings.** | Keeps the nav short, and gives the demo controls a home other than a menu nobody opens. |
| **L4** | **Loading indicators are written in CSS, not Material.** | Measured, not assumed: `mat-progress-bar` + `mat-progress-spinner` cost **21.55 kB** and take the initial bundle to 661.34 kB, past the 650 kB budget warning. The bar alone is 11.95 kB and still crosses it. The CSS pair costs **1.77 kB**. |

---

## A1 — Loading feedback

Two gaps, both of them the same complaint: *nothing tells me my click landed*.

- **Between clicking a nav link and the page's skeleton** there was nothing at all. Every feature is lazy loaded, so that gap is a chunk being fetched, and on a slow connection it looked like the app had ignored the click. `RouteProgressComponent` fills exactly that gap.
- **Thirteen action buttons disabled without any other sign.** With the mock API's 300–800 ms latency a disabled button that looks identical is close to no feedback. `BusyLabelComponent` puts a spinner in the button and fades the label.

The three `[pending]` states that already existed — booth tiles, interview slots, pipeline cards — signalled with `opacity: 0.6` alone, which reads as *disabled*, the opposite of what an in-flight request means. They keep the fade and gain the shared spinner.

## A2 — Settings

Bottom section in the side nav, its own lazy route per role, and the demo controls moved out of the role-switcher menu.

## A3 — Audit log

Recorded in `runMockRequest` — the one point every write passes through — with a per-route describer supplying the record to snapshot, so coverage is structural rather than something each handler must remember. Staff-only read, newest first. `GET /audit-entries`.

Limits to state plainly, on the page as well as here: reads are not logged, the log resets with the demo data, and a client-side log is not tamper-proof. The real one is a table only the server writes.

---

## Facts discovered

### A2

- **Settings is a second list, not a last item.** Pinned with `margin-top: auto` on its own `<ul>`, so anyone reading the nav as a list hears two groups rather than one list with a gap in the middle. Verified pinned to the bottom in all three nav shapes — full menu, 72px rail and mobile drawer.
- **One page, three routes.** Each role's section sits behind its own `roleGuard`, so a single `/settings` would 404 for two roles out of three. `SETTINGS_BY_ROLE` is a record over `Role` for the same reason the menus are: the compiler names a role that was forgotten instead of sending it somewhere its guard refuses.
- **Moving the demo controls made the app smaller.** They were the only user of `MatDividerModule` in the initial bundle, so taking them out of the role menu dropped the initial total from 641.56 kB to **640.29 kB** — below where A1 left it, while adding a whole page.
- **Reset now asks first.** In the menu it was a single click that threw away everything done in the session, with no undo and no confirmation. It uses the existing destructive confirm dialog, which the browser check confirms renders red (`rgb(185, 28, 28)`).
- **The reset was verified by reversing a change, not by watching for a reload.** Approve an application (queue 4 → 3), reset, and the queue reads 4 again. A page that reloads proves nothing about whether the data went back.
- **The nav spec had to learn the difference between the two lists.** Its `labels()` helper read every `.nav__label` in the component, so Settings silently joined three existing expectations. Scoping it to the main list keeps those tests about the main menu, and four new ones cover the end section: that it holds Settings for every role, that each role gets the route its guard allows, and that Settings stays *out* of the main menu.
- **`@angular/animations` is not installed**, so `provideNoopAnimations()` cannot be used in a spec here. Material components render in tests without it.
- **The accessible name is "Settings", not "settingsSettings".** `mat-icon` renders its name as a ligature in the text content; it is `aria-hidden`, so the computed name excludes it — checked through `getByRole` with an exact name rather than by reading `textContent`, which is what made it look wrong in the first place.
- **Verified:** 18 pages at three viewports, 0 axe violations, 0 CSP violations, 0 console errors. In a browser, for all three roles: Settings sits below the main menu, lands on the right route, names the current identity, and the role menu now holds identities only.
- **Cost:** initial total 641.56 kB → 640.29 kB. Settings is a 30.76 kB lazy chunk shared by all three roles.

### A1

- **Material's progress components do not fit the budget.** `mat-progress-bar` + `mat-progress-spinner` in the shell: 639.79 → **661.34 kB**, past the 650 kB warning. The bar on its own: 651.74 kB, still past it. The CSS replacements cost 1.77 kB together. This is the fallback named in the plan, taken because a measurement said so rather than because it felt likely.
- **A spinner that changes a button's width moves the button under the pointer.** The label is faded with `opacity`, not removed and not swapped for "Saving…", so the box keeps its size — measured at **0.0 px width shift** on all five paths driven in a browser. `opacity` also keeps the text in the accessibility tree, so the button keeps its name while busy: `aria-busy="true"` on a control still called "Save profile".
- **One row, two buttons, two spinners.** A queue card carries Approve and Turn down, both disabled while either runs, and keyed on the row alone **both** showed a spinner — the card claimed two things were happening when one was. The store now tracks which decision is in flight, not just which row. Caught in a browser; no test would have noticed, because both states were individually correct.
- **A fade is not a working state.** The pre-existing `[pending]` styling was `opacity: 0.6` and nothing else. Static transparency is the same signal this app uses for *disabled*, so a booth mid-assignment looked switched off. Motion is what distinguishes them.
- **The bar has to stop on three events, not one.** `NavigationEnd` alone would strand it on screen forever the first time a `roleGuard` redirect fires, because that emits `NavigationCancel`. `NavigationError` matters too — a failed chunk fetch is precisely when someone is staring at the bar.
- **`toSignal`, not a subscription.** The app is zoneless; a subscription writing to a plain field tells Angular nothing and the bar would never appear. The same bit caught the first draft of the spec: setting a plain property on a test host did not update a signal input, and three tests failed until the host drove the input with a signal.
- **Reduced motion slows the spinner rather than stopping it.** A still ring reads as a broken icon, and the element's whole purpose is to say something is happening. Verified at 2.4s under `prefers-reduced-motion: reduce`; the route bar drops its slide for a static tint.
- **Verified:** 15 pages at three viewports plus both transient busy states under axe — 0 violations, 0 CSP violations, 0 console errors. In a browser: the bar appears mid-navigation at 1200×3 under the top bar with `aria-label="Loading page"` and clears afterwards; spinners confirmed on Apply, Shortlist (an icon button), Save profile, Register and Approve, including the two behind confirmation dialogs.
- **Cost:** initial total 639.79 kB → 641.56 kB.
