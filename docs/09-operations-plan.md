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
