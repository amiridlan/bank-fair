import type { InterviewSlot, Shortlist } from '../../models';
import { klTimestamp } from '../seed/kl-time';
import { buildSlotsFor } from '../seed/seed-engagements';
import {
  type MockHandler,
  conflict,
  created,
  noContent,
  notFound,
  ok,
  okList,
  validationError,
} from '../mock-response';
import { maskForViewer } from './candidates.handler';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------- shortlists

/** `GET /shortlists` — always scoped to the viewer's own employer. */
export const listShortlists: MockHandler = ({ db, query, currentUser }) => {
  const employerId = currentUser.employerId;
  if (employerId === null) {
    return okList([]);
  }

  const fairId = query.get('fair_id');
  const shortlists = db.shortlists
    .filter((shortlist) => shortlist.employerId === employerId)
    .filter((shortlist) => !fairId || shortlist.fairId === fairId)
    // The embedded candidate is unmasked: shortlisting is what unlocks it.
    .map((shortlist) => ({
      ...shortlist,
      candidate: maskForViewer(shortlist.candidate, db, currentUser),
    }));

  return okList(shortlists);
};

/** `POST /shortlists` — 409 when this employer already shortlisted them. */
export const createShortlist: MockHandler = ({ db, body, currentUser, now }) => {
  const employerId = currentUser.employerId;
  if (employerId === null) {
    return notFound('Only an employer can shortlist candidates.');
  }

  const payload = isRecord(body) ? body : {};
  const candidateId = payload['candidateId'];
  const fairId = payload['fairId'];

  const errors: Record<string, readonly string[]> = {};
  if (typeof candidateId !== 'string') {
    errors['candidateId'] = ['The candidate field is required.'];
  }
  if (typeof fairId !== 'string') {
    errors['fairId'] = ['The fair field is required.'];
  }
  if (Object.keys(errors).length > 0) {
    return validationError(errors);
  }

  const candidate = db.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    return notFound('Candidate not found.');
  }
  if (!db.fairs.some((fair) => fair.id === fairId)) {
    return notFound('Fair not found.');
  }

  const duplicate = db.shortlists.some(
    (shortlist) =>
      shortlist.employerId === employerId &&
      shortlist.candidateId === candidateId &&
      shortlist.fairId === fairId,
  );
  if (duplicate) {
    return conflict(`${candidate.fullName} is already on your shortlist for this fair.`);
  }

  const note = typeof payload['note'] === 'string' && payload['note'].trim() ? payload['note'].trim() : null;

  const shortlist: Shortlist = {
    id: `sl-${String(db.shortlists.length + 1).padStart(3, '0')}-${Date.now().toString(36)}`,
    employerId,
    candidateId: candidate.id,
    fairId: fairId as string,
    note,
    createdAt: klTimestamp(0, 12, 0, now),
    candidate,
  };

  db.shortlists = [shortlist, ...db.shortlists];

  // The candidate is now unmasked for this employer.
  return created({ ...shortlist, candidate: maskForViewer(candidate, db, currentUser) });
};

/** `DELETE /shortlists/{id}`. Also frees any slot booked for that candidate. */
export const deleteShortlist: MockHandler = ({ db, params, currentUser }) => {
  const employerId = currentUser.employerId;
  const index = db.shortlists.findIndex(
    (shortlist) => shortlist.id === params['id'] && shortlist.employerId === employerId,
  );
  if (index < 0) {
    return notFound('Shortlist entry not found.');
  }

  const [removed] = db.shortlists.splice(index, 1);

  // Leaving a booking for an un-shortlisted candidate would strand a slot the
  // interviews page can no longer explain.
  db.interviewSlots = db.interviewSlots.map((slot) =>
    slot.employerId === employerId &&
    slot.fairId === removed.fairId &&
    slot.candidateId === removed.candidateId
      ? { ...slot, candidateId: null, candidateName: null }
      : slot,
  );

  return noContent();
};

// ----------------------------------------------------------- interview slots

/**
 * `GET /interview-slots?fair_id=` — slots for the viewer's own employer.
 *
 * Only two employers have seeded slots (decision D2), so any other employer's
 * grid is generated on demand and kept, rather than seeding ~7,000 rows the
 * demo never reads.
 */
export const listInterviewSlots: MockHandler = ({ db, query, currentUser, now }) => {
  const employerId = currentUser.employerId;
  const fairId = query.get('fair_id');

  if (employerId === null || !fairId) {
    return okList([]);
  }

  let slots = db.interviewSlots.filter(
    (slot) => slot.employerId === employerId && slot.fairId === fairId,
  );

  if (slots.length === 0) {
    const generated = buildSlotsFor(employerId, fairId, now);
    if (generated.length > 0) {
      db.interviewSlots = [...db.interviewSlots, ...generated];
      slots = generated;
    }
  }

  return okList([...slots].sort((a, b) => a.startTime.localeCompare(b.startTime)));
};

/**
 * `PATCH /interview-slots/{id}` with `{ candidate_id }`.
 *
 * 409 when the slot was taken in the meantime — the UI shows "That slot was
 * just booked. Pick another." and refreshes the grid. Passing null cancels.
 */
export const updateInterviewSlot: MockHandler = ({ db, params, body, currentUser }) => {
  const index = db.interviewSlots.findIndex((slot) => slot.id === params['id']);
  if (index < 0) {
    return notFound('Interview slot not found.');
  }

  const slot = db.interviewSlots[index];
  if (slot.employerId !== currentUser.employerId) {
    return notFound('Interview slot not found.');
  }

  const payload = isRecord(body) ? body : {};
  const candidateId = payload['candidateId'];

  if (candidateId === null || candidateId === undefined) {
    db.interviewSlots[index] = { ...slot, candidateId: null, candidateName: null };
    return ok(db.interviewSlots[index]);
  }

  if (typeof candidateId !== 'string') {
    return validationError({ candidateId: ['The candidate field is required.'] });
  }

  if (slot.candidateId !== null && slot.candidateId !== candidateId) {
    return conflict('That slot was just booked. Pick another.');
  }

  // Only a shortlisted candidate can be booked, which is what makes the
  // "shortlist first" branch in the UI meaningful.
  const shortlist = db.shortlists.find(
    (entry) =>
      entry.employerId === currentUser.employerId &&
      entry.candidateId === candidateId &&
      entry.fairId === slot.fairId,
  );
  if (!shortlist) {
    return validationError({
      candidateId: ['Shortlist this candidate before booking an interview.'],
    });
  }

  // One interview per candidate per fair.
  const alreadyBooked = db.interviewSlots.some(
    (other: InterviewSlot) =>
      other.id !== slot.id &&
      other.employerId === slot.employerId &&
      other.fairId === slot.fairId &&
      other.candidateId === candidateId,
  );
  if (alreadyBooked) {
    return conflict(`${shortlist.candidate.fullName} already has an interview at this fair.`);
  }

  db.interviewSlots[index] = {
    ...slot,
    candidateId,
    candidateName: shortlist.candidate.fullName,
  };

  return ok(db.interviewSlots[index]);
};
