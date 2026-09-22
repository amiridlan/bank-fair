import type {
  AuditEntry,
  Booth,
  Candidate,
  Employer,
  Fair,
  FairApplication,
  FairRegistration,
  InterviewSlot,
  Shortlist,
  User,
} from '../models';
import { DEMO_USERS } from '../auth/auth.store';
import { SeededRandom } from './seed/random';
import { seedBooths } from './seed/seed-booths';
import { seedCandidates } from './seed/seed-candidates';
import { seedEmployers } from './seed/seed-employers';
import { seedFairs } from './seed/seed-fairs';
import {
  applySeedBookings,
  seedFairApplications,
  seedFairRegistrations,
  seedInterviewSlots,
  seedShortlists,
} from './seed/seed-engagements';

/**
 * In-memory tables standing in for the Laravel database.
 *
 * Plain arrays, not signals: nothing subscribes to the database directly.
 * Components read the stores, which read the API, which reads this.
 *
 * Handlers must treat rows as immutable — replace an object rather than
 * mutating it — so a record already handed to the app never changes under it.
 */
export interface MockDb {
  users: User[];
  fairs: Fair[];
  booths: Booth[];
  employers: Employer[];
  candidates: Candidate[];
  shortlists: Shortlist[];
  interviewSlots: InterviewSlot[];
  fairRegistrations: FairRegistration[];
  fairApplications: FairApplication[];
  /**
   * Written by the engine, never by a handler (docs/09 A3). Empty at seed:
   * the log records what happened in this session, and inventing history
   * would make it a fiction rather than a record.
   */
  auditEntries: AuditEntry[];
}

/**
 * Builds a complete database from the fixed seed.
 *
 * `now` is injectable so tests can pin the relative dates instead of depending
 * on when the suite happens to run.
 */
export function buildMockDb(now: number = Date.now()): MockDb {
  const random = new SeededRandom();

  const employers = seedEmployers(random, now);
  const booths = seedBooths(random, seedFairs(now), employers);

  /**
   * Booths are the source of truth for the fill rate.
   *
   * docs/05 also lists per-fair fill targets, but those cannot all hold: they
   * need 122 occupied booths (and 38 at one fair) while the stage distribution
   * yields only 30 committed employers, each holding at most one booth per
   * fair. Deriving the count from the booths keeps the floor plan, the fair
   * list and the dashboard agreeing with each other, which matters more than
   * hitting a specific percentage.
   */
  const fairs = seedFairs(now).map((fair) => ({
    ...fair,
    boothAssigned: booths.filter((booth) => booth.fairId === fair.id && booth.employerId !== null)
      .length,
  }));

  const candidates = seedCandidates(random, now);
  const shortlists = seedShortlists(random, candidates, now);
  const interviewSlots = applySeedBookings(seedInterviewSlots(now), shortlists);

  return {
    users: [...DEMO_USERS],
    fairs,
    employers,
    booths,
    candidates,
    shortlists,
    interviewSlots,
    // Derived from the candidates' seeded fairIds, so the demo opens with
    // registrations already in place rather than an empty portal.
    fairRegistrations: seedFairRegistrations(candidates, now),
    // A few pending applications, so the staff queue opens with work in it.
    fairApplications: seedFairApplications(employers, now),
    auditEntries: [],
  };
}

/**
 * The live database for this browser session.
 *
 * In-memory by design: it survives navigation and resets on a full reload,
 * which makes the demo repeatable. `POST /demo/reset` reseeds it in place.
 */
let db: MockDb = buildMockDb();

export function getMockDb(): MockDb {
  return db;
}

export function resetMockDb(now: number = Date.now()): MockDb {
  db = buildMockDb(now);
  return db;
}
