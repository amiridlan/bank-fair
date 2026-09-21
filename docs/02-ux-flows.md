# 02 — UX: Proto-personas, IA, Flows, States

## Proto-personas (assumption-based)

These are **not** research-based personas. Each lists how to validate it.

### Staff — employer liaison / ops — PROTO-PERSONA
- **Context:** Manages 50–100 employers across several fairs. At a desk, on a laptop, all day.
- **Goal:** Every booth sold and assigned before the fair; knows each employer's status instantly.
- **Blocker (assumed):** Status lives in spreadsheets and email threads; floor plans are edited by hand.
- **Validate by:** Asking how bookings and booth allocation are managed today.

### Hiring manager — employer client — PROTO-PERSONA
- **Context:** Busy HR or line manager. Uses the portal in short sessions in the week before the fair.
- **Goal:** Arrive at the fair with a shortlist and interviews already booked.
- **Blocker (assumed):** Meets candidates cold at the booth with no pre-screening.
- **Validate by:** Asking what employers say they want most from the fair.

## Information architecture

```
/                         → redirect by role
/staff
  /dashboard              M1
  /fairs                  M2 list
  /fairs/:fairId          M2 detail (tabs: Overview | Floor plan | Employers)
  /fairs/:fairId/floor-plan  M3 (also reachable as a tab)
  /employers              M4 Kanban
  /employers/:employerId  M4 detail (drawer over Kanban, deep-linkable)
/hiring
  /talent-pool            M5
  /talent-pool/:candidateId  M5 profile drawer (deep-linkable)
  /shortlist              M5 shortlist view
  /interviews             M6
/not-found                404
```

- Side nav shows only the active role's routes.
- A `roleGuard` redirects to the role's home if the user opens the other role's URL.
- Deep links must work on page refresh (drawers open from route params, not only from clicks).

## Flow specs

### F1 — Assign an employer to a booth (staff)
**Goal:** Employer has a booth · **Entry:** Fair detail → Floor plan tab, or from an employer drawer ("Assign booth") · **Success:** Booth shows employer name; employer shows booth code.

1. Floor plan shows booth grid + a side list of **Confirmed/Paid employers without a booth**.
2. Drag employer onto an empty booth → optimistic update → API `PATCH /booths/:id`.
3. Snackbar: "Acme Bhd assigned to A-04. Undo".

**Branches:** Drop on an occupied booth → confirm dialog "Replace Beta Sdn Bhd with Acme Bhd?".
**Keyboard alternative (required):** Select a booth → "Assign employer" button → searchable select → Save.
**Errors:** API fails → revert the booth, snackbar "Couldn't assign booth. Try again." with Retry.
**Empty:** No unassigned employers → "All confirmed employers have booths." Fair has no booths → "No floor plan yet for this fair."
**Preserved on exit:** Every assignment saves immediately; nothing is lost on leaving.

### F2 — Move an employer through the pipeline (staff)
**Goal:** Stage reflects reality · **Entry:** `/staff/employers` · **Success:** Card sits in the new column; `updatedAt` changes.

1. Drag card to another column → optimistic update → `PATCH /employers/:id { stage }`.
2. Moving to **Lost** opens a dialog asking for a reason (required).
3. Moving to **Paid** requires a booth package to be set; if missing, open the edit form.

**Keyboard alternative:** Card menu → "Move to…" → stage list.
**Errors:** Revert card, snackbar with Retry.
**Empty column:** "No employers in Proposal."

### F3 — Add / edit an employer (staff)
1. "Add employer" → dialog form: Company name*, Industry*, Company size*, Contact name*, Contact email*, Contact phone, Booth package, Notes.
2. Save → `POST` or `PATCH` → card appears in **Lead** (new) or updates in place.

**Validation:** Inline, on blur and on submit. Email format. Malaysian phone format optional (`+60…`).
**Errors:** 422 → map to fields. Other → form stays open, error banner at top, Save re-enabled.
**Exit:** Closing a dirty form asks "Discard changes?".

### F4 — Find and shortlist candidates (hiring manager)
**Goal:** A shortlist for the fair · **Entry:** `/hiring/talent-pool` · **Success:** Candidate appears in Shortlist.

1. Filters: search (name/skill), university, field of study, graduation year, min CGPA. Filters sync to URL query params (shareable, survive refresh).
2. Table sorts by name, university, graduation year, CGPA. Paginated (20/page, server-side via API).
3. Row click → profile drawer → "Add to shortlist" (optional note).

**Empty (no results):** "No candidates match these filters." + "Clear filters" button.
**Overflow:** Pagination; skills chips truncate to 3 + "+N".
**Privacy:** Email/phone masked until shortlisted.

### F5 — Book an interview slot (hiring manager)
1. `/hiring/interviews` → choose fair (defaults to next upcoming) → slot grid, 20-min slots, 10:00–17:00.
2. Click an open slot → dialog: select a shortlisted candidate → Book.
3. Booked slot shows candidate name; click to Cancel (confirm dialog).

**Branch:** No shortlisted candidates → dialog shows "Shortlist candidates first" + link to Talent pool.
**Error:** Slot taken (409) → "That slot was just booked. Pick another." and refresh the grid.

## Required states for every data view

| State | Pattern |
|---|---|
| Loading | Skeleton rows/cards matching final layout (not a lone spinner) |
| Empty | Say what belongs here + primary action to create the first one |
| Error | What happened + Retry button. Never raw error codes |
| Loaded | Normal view |
| Partial | e.g. dashboard: one failed widget shows its own error; others still render |

## Microcopy rules

- Buttons state the outcome: "Assign booth", "Add to shortlist", "Book slot" — never "Submit" or "OK".
- Errors: what happened + next step. "Couldn't load candidates. Check your connection and retry."
- Confirmations name the object: "Cancel interview with Nur Aisyah at 10:40?"
- Dates `DD/MM/YYYY`, money `RM 3,500.00`.

## Accessibility checklist (WCAG 2.2 AA)

- Every input has a visible `<mat-label>`; never placeholder-only.
- Every drag-and-drop action has a keyboard/button alternative.
- Focus order matches visual order; dialogs trap and restore focus (Material does this; do not break it).
- Status changes (assign, move, book) are announced via `LiveAnnouncer`.
- Status is never shown by colour alone: chips have text + icon.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components.
- Touch targets ≥ 44×44 px.
- Respect `prefers-reduced-motion`.
