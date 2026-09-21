import type { Candidate, InterviewSlot, Shortlist } from '../../models';
import { klTimestamp } from './kl-time';
import { SeededRandom } from './random';

/** Employers whose interview slots are seeded up front (decision D2). */
export const SLOTTED_EMPLOYER_IDS: readonly string[] = ['emp-001', 'emp-002'];

/** Fairs those slots are seeded for. */
export const SLOTTED_FAIR_IDS: readonly string[] = ['fair-01', 'fair-02', 'fair-03'];

/** Which day each fair's slots fall on, as an offset from today. */
const FAIR_DAY_OFFSET: Readonly<Record<string, number>> = {
  'fair-01': 0,
  'fair-02': 21,
  'fair-03': 45,
};

const FIRST_HOUR = 10;
const LAST_HOUR = 17;
const SLOT_MINUTES = 20;

/**
 * Builds one fair day of 20-minute slots, 10:00 to 17:00 — 21 per employer per
 * fair day.
 *
 * Exported because the handler generates slots on demand for any employer that
 * was not seeded, rather than seeding all 60 employers across all fairs, which
 * would be roughly 7,000 records nothing in the demo ever reads.
 */
export function buildSlotsFor(employerId: string, fairId: string, now: number): InterviewSlot[] {
  const dayOffset = FAIR_DAY_OFFSET[fairId];
  if (dayOffset === undefined) {
    return [];
  }

  const slots: InterviewSlot[] = [];
  for (let hour = FIRST_HOUR; hour < LAST_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const endMinute = minute + SLOT_MINUTES;
      slots.push({
        id: `slot-${fairId}-${employerId}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`,
        fairId,
        employerId,
        startTime: klTimestamp(dayOffset, hour, minute, now),
        endTime: klTimestamp(dayOffset, endMinute === 60 ? hour + 1 : hour, endMinute % 60, now),
        candidateId: null,
        candidateName: null,
      });
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
