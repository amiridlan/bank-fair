# 01 — Project Overview

## Purpose

FairOps is a portfolio project built to demonstrate modern Angular skills for a career platform that runs large-scale career fairs in Malaysia.

The goal is a polished, deployable demo that shows:

1. Command of modern Angular (standalone, signals, new control flow, lazy loading).
2. Real understanding of the career fair business: selling booths, managing employers, connecting employers with candidates.
3. Production habits: typed code, error handling, accessibility, tests, a clean path to a real backend.

## Users and roles

| Role | Who | Main goal |
|---|---|---|
| `staff` | Organiser team (ops, employer liaison, sales) | Fill every booth, track each employer's status, run fair day smoothly |
| `hiring_manager` | Employer client who bought a booth | Leave the fair with a shortlist and booked interviews |

A role switcher in the top bar changes the active role. This is **mock auth for the demo only**.

The architecture must allow more roles later (for example, `candidate`, `university_partner`) without restructuring.

## Modules (MVP scope)

| # | Module | Role | Summary |
|---|---|---|---|
| M1 | Dashboard | staff | KPIs for upcoming fairs, booth fill rate, registrations, pipeline value (RM) |
| M2 | Fairs | staff | List, filter, and view fairs; fair detail page with tabs |
| M3 | Floor plan | staff | Grid of booths per fair; drag an employer onto a booth to assign it |
| M4 | Employer pipeline | staff | Kanban board: Lead → Proposal → Confirmed → Paid (+ Lost); employer detail drawer; add/edit employer form |
| M5 | Talent pool | hiring_manager | Filterable, sortable, paginated candidate table; candidate profile drawer; shortlist |
| M6 | Interview slots | hiring_manager | Slot grid per fair day; book a shortlisted candidate into a slot; cancel booking |
| M7 | Shell | both | Top bar, side nav (role-aware), role switcher, "Reset demo data" |

## Out of scope (MVP)

- Real authentication and authorisation
- Candidate-facing portal
- Payments, invoicing, emails, notifications
- File uploads (resumes)
- Real-time updates (WebSockets)
- i18n (Bahasa Malaysia) — architecture should not block it

## Roadmap (post-MVP)

| Phase | Item | Notes |
|---|---|---|
| R1 | Laravel 12 + PostgreSQL API | Remove mock interceptor; endpoints already match `docs/04-architecture.md` |
| R2 | Real auth | Laravel Sanctum (SPA cookie auth), role-based policies server-side |
| R3 | **AI feature (planned, not yet scoped)** | Candidates: candidate-to-role matching score, shortlist suggestions, or auto-summarised candidate profiles. Must run server-side (never call an LLM API from the browser with a key). User will confirm scope before building. |
| R4 | Candidate portal | Registration, QR check-in pass for fair day |
| R5 | Bahasa Malaysia (ms-MY) | Angular i18n |
| R6 | SSR | Only for public pages (fair listings) for SEO |

## Success criteria for the demo

- Deployed live URL + public GitHub repo with a clear README.
- Every module works end-to-end with dummy data.
- No console errors. Lighthouse accessibility score ≥ 95 on main pages.
- Works on desktop (primary) and tablet; usable on mobile.
- The developer can explain every key concept listed in `docs/06-build-plan.md`.

## Key assumptions (unvalidated)

These come from public information, not user research. Validate them in the interview.

1. Staff currently track employer bookings in spreadsheets and email.
2. Booth allocation is a manual, visual task done against a floor plan.
3. Employers value pre-fair access to candidate profiles.

Ask the interviewer: *"How does your team manage employer bookings and booth allocation today?"*
