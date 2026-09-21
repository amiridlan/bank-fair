# BankFair

A career fair operations portal for organiser staff and employer hiring managers, built with **Angular 22**.

> Portfolio demo. The frontend runs against an in-memory mock HTTP API; a Laravel 12 + PostgreSQL backend replaces it later without touching feature code.

## Status

Phase 1a (scaffold) complete. See `docs/06-build-plan.md` for the remaining phases.

## Requirements

- **Node.js ≥ 22.22.3** — Angular 22's CLI hard-fails below this.
- npm ≥ 11 for `npm install`. `npm ci` works on any version.

## Commands

```bash
npm ci                         # install from the lockfile
npm run build                  # production build → dist/bank-fair/browser
npm test -- --watch=false      # unit tests (Vitest), single run
npm run lint                   # angular-eslint
```

## Documentation

`CLAUDE.md` holds the engineering rules. `docs/` holds the project overview, UX flows, design system, architecture, mock data spec and build plan.

A full README — features, screenshots, tech decisions and architecture diagram — is written in Phase 6.
