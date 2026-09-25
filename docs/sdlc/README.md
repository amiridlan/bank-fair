# SDLC Documentation — BankFair

Formal lifecycle documentation for BankFair, written **retrospectively** on
25/09/2026 against a system that was already complete.

That framing matters, and it is stated at the top of each document. The
templates these follow are built to specify work before it starts; used on
finished software they invite invented budgets, invented stakeholders and
invented sign-offs. Those sections are marked **N/A with the reason** instead.
Every figure in this set is measured from the repository and can be checked.

## Methodology

**Hybrid.** Each workstream began with a written plan committed to `docs/` and
approved before any code — Waterfall-shaped gating, and the commit order shows
it. Execution inside each phase was iterative, and revised its own decisions
when the code disagreed. See PC-001 §9.

## The documents

| # | Document | ID | Answers |
|---|---|---|---|
| 01 | [Project Charter](01-project-charter.md) | PC-001 | Why this exists, what it set out to do, what it delivered |
| 02 | [Software Requirements Specification](02-software-requirements-specification.md) | SRS-001 | What it does — 67 functional and 32 non-functional requirements, each traced to a verifying test, plus the API contract Laravel must honour |
| 03 | [Software Design Document](03-software-design-document.md) | SDD-001 | How it is built — architecture, state, the mock API, the relational shape for Laravel, security design |
| 04 | [Architecture Decision Records](04-architecture-decision-records.md) | ADR-SET-001 | Why the twelve significant choices were made, and what they cost |
| 05 | [Coding Standards](05-coding-standards.md) | CS-001 | The rules the code is held to, and which are enforced by a machine |
| 06 | [Test Report](06-test-report.md) | TR-001 | What is verified — 401 tests, ten mutation checks, and the defects only a browser found |
| 07 | [Known Issues & Maintenance](07-known-issues-and-maintenance.md) | KI-001 | What is not done, what would break, and what a maintainer needs to know |

## Relationship to the rest of `docs/`

| Set | Nature |
|---|---|
| `docs/sdlc/` (this) | Formal lifecycle documents, written once, describing the finished system |
| `docs/01`–`docs/11` | The working plans written *during* the build, one per workstream, each recording what was decided and what the implementation then turned up |
| `docs/diagrams/` | Four rendered Mermaid diagrams: architecture, write-request path, data model, entity lifecycles |

The SDLC set **cites** the working plans rather than replacing them. The plans
hold reasoning captured while the work was happening, including the reversals —
which is information that cannot be reconstructed afterwards. Both are worth
keeping.

## Where to start

- **Reviewing the project?** PC-001, then TR-001 §4 and §5.
- **Implementing the backend?** SRS-001 §5.1 (the contract), then SDD-001 §5 (the schema).
- **Maintaining the code?** CS-001, then KI-001 §3 and §4.
- **Wondering why something looks odd?** ADR-SET-001, then the relevant plan in `docs/`.

## Honest summary of state

Complete and deployed as a portfolio demonstration: 401 tests passing, lint
clean, 640.69 kB initial bundle against a 650 kB budget, axe-core clean at
1440px and 390px.

**Not suitable for production use with real personal data**, for four reasons
set out in TR-001 §10 — no authentication, no persistence, no right to erasure,
and a talent pool that does not yet scope candidates to the fairs they
consented to. The first two are deliberate scope decisions resolved by building
the backend. The last is a real defect with an agreed plan: see KI-04, and do
it first.
