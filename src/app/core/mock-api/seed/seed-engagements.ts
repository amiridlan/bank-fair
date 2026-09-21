import type {
  Candidate,
  Employer,
  FairApplication,
  FairRegistration,
  InterviewSlot,
  Shortlist,
} from '../../models';
import { klTimestamp } from './kl-time';
import { SeededRandom } from './random';

/** Employers whose interview slots are seeded up front (decision D2). */
export const SLOTTED_EMPLOYER_IDS: readonly string[] = ['emp-001', 'emp-002'];

/** Fairs those slots are seeded for. */
export const SLOTTED_FAIR_IDS: readonly string[] = ['fair-01', 'fair-02', 'fair-03'];

/**
 * Which days each fair's slots fall on, as offsets from today.
 *
 * These mirror the fair records in seed-fairs.ts: fair-01 runs today and
 * tomorrow, fair-02 runs on days 21 and 22, fair-03 is a single day. docs/05
 * specifies "21 per fair **day**", but this table held one offset per fair, so
 * both two-day fairs were missing their second day entirely — half the slots
 * the fair's own date range implies.
 */
const FAIR_DAY_OFFSETS: Readonly<Record<string, readonly number[]>> = {
  'fair-01': [0, 1],
  'fair-02': [21, 22],
  'fair-03': [45],
};

const FIRST_HOUR = 10;
const LAST_HOUR = 17;
const SLOT_MINUTES = 20;

/**
 * Builds every fair day of 20-minute slots, 10:00 to 17:00 — 21 per employer
 * per fair day, so 42 for a two-day fair.
 *
 * Exported because the handler generates slots on demand for any employer that
 * was not seeded, rather than seeding all 60 employers across all fairs, which
 * would be roughly 7,000 records nothing in the demo ever reads.
 */
export function buildSlotsFor(employerId: string, fairId: string, now: number): InterviewSlot[] {
  const dayOffsets = FAIR_DAY_OFFSETS[fairId];
  if (dayOffsets === undefined) {
    return [];
  }

  const slots: InterviewSlot[] = [];
  for (const dayOffset of dayOffsets) {
    for (let hour = FIRST_HOUR; hour < LAST_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const endMinute = minute + SLOT_MINUTES;
        slots.push({
          // The day is part of the id: without it, day two's slots would
          // collide with day one's.
          id: `slot-${fairId}-${employerId}-d${dayOffset}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`,
          fairId,
          employerId,
          startTime: klTimestamp(dayOffset, hour, minute, now),
          endTime: klTimestamp(dayOffset, endMinute === 60 ? hour + 1 : hour, endMinute % 60, now),
          candidateId: null,
          candidateName: null,
        });
      }
    }
  }
  return slots;
}

export function seedInterviewSlots(now: number): InterviewSlot[] {
  const slots: InterviewSlot[] = [];
  for (const employerId of SLOTTED_EMPLOYER_IDS) {
    for (const fairId of SLOTTED_FAIR_IDS) {
      slots.push(...buildSlotsFor(employerId, fairId, now));
    }
  }
  return slots;
}

/**
 * Six shortlists for the first hiring manager's employer, so the demo opens on
 * a populated shortlist rather than an empty state — and three of them are
 * pre-booked into slots.
 */
export function seedShortlists(
  random: SeededRandom,
  candidates: readonly Candidate[],
  now: number,
): Shortlist[] {
  // Draw from candidates actually attending fair-01.
  const pool = candidates.filter((candidate) => candidate.fairIds.includes('fair-01'));
  const chosen = random.sample(pool.length >= 6 ? pool : candidates, 6);

  return chosen.map((candidate, index) => ({
    id: `sl-${String(index + 1).padStart(3, '0')}`,
    employerId: 'emp-001',
    candidateId: candidate.id,
    fairId: 'fair-01',
    note: index === 0 ? 'Strong portfolio — prioritise for the morning slot.' : null,
    createdAt: klTimestamp(-random.int(1, 10), 11, 0, now),
    candidate,
  }));
}

/** Books the first three shortlisted candidates into emp-001's fair-01 slots. */
export function applySeedBookings(
  slots: InterviewSlot[],
  shortlists: readonly Shortlist[],
): InterviewSlot[] {
  const bookable = slots.filter(
    (slot) => slot.employerId === 'emp-001' && slot.fairId === 'fair-01',
  );

  return slots.map((slot) => {
    const position = bookable.indexOf(slot);
    if (position < 0 || position >= 3) {
      return slot;
    }

    const shortlist = shortlists[position];
    if (!shortlist) {
      return slot;
    }

    return {
      ...slot,
      candidateId: shortlist.candidateId,
      candidateName: shortlist.candidate.fullName,
    };
  });
}

/**
 * One registration row per (candidate, fair) the seeder already paired up.
 *
 * `Candidate.fairIds` was the only record of who is attending what. Consent is
 * backdated to the seed's own clock rather than invented as "now", so a demo
 * opened tomorrow does not claim everyone consented tomorrow.
 */
export function seedFairRegistrations(
  candidates: readonly Candidate[],
  now: number,
): FairRegistration[] {
  const registeredAt = klTimestamp(-14, 9, 0, now);

  return candidates.flatMap((candidate) =>
    candidate.fairIds.map((fairId) => ({
      id: `reg-${candidate.id}-${fairId}`,
      fairId,
      candidateId: candidate.id,
      registeredAt,
      consentedAt: registeredAt,
    })),
  );
}

/**
 * Pending applications from employers not yet attending `fair-02`, plus one
 * already-decided pair so the queue's filters have something to show.
 *
 * Employers already carrying a fair in `fairIds` are treated as approved
 * historically — they are at the fair, which is the only evidence the seed
 * has — so no application row is invented for them.
 */
export function seedFairApplications(
  employers: readonly Employer[],
  now: number,
): FairApplication[] {
  const appliedAt = klTimestamp(-5, 10, 30, now);
  const decidedAt = klTimestamp(-3, 14, 0, now);

  const candidates = employers
    .filter((employer) => !employer.fairIds.includes('fair-02'))
    .filter((employer) => employer.stage !== 'lost')
    .slice(0, 6);

  return candidates.map((employer, index) => {
    const base = {
      id: `app-seed-${employer.id}`,
      fairId: 'fair-02',
      employerId: employer.id,
      employerName: employer.name,
      appliedAt,
    };

    if (index === 4) {
      return { ...base, status: 'approved' as const, decidedAt, rejectionReason: null };
    }
    if (index === 5) {
      return {
        ...base,
        status: 'rejected' as const,
        decidedAt,
        rejectionReason: 'The fair is full for this industry. Try the next one.',
      };
    }
    return { ...base, status: 'pending' as const, decidedAt: null, rejectionReason: null };
  });
}
