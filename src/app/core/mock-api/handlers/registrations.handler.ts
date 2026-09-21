import type { Candidate, FairRegistration } from '../../models';
import {
  type MockHandler,
  conflict,
  created,
  noContent,
  notFound,
  okList,
  validationError,
} from '../mock-response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `GET /fair-registrations` — always scoped to the viewer's own candidate
 * record. There is no parameter for reading someone else's.
 */
export const listRegistrations: MockHandler = ({ db, currentUser }) => {
  const candidateId = currentUser.candidateId;
  if (candidateId === null) {
    return okList([]);
  }

  return okList(db.fairRegistrations.filter((entry) => entry.candidateId === candidateId));
};

/**
 * `POST /fair-registrations` — a job seeker registers for a fair.
 *
 * Instant, with no approval step (docs/08 S-D3): a job seeker attending costs
 * nothing, unlike an employer taking a booth.
 *
 * `consent` is required and must be `true`. Refusing to default it is the
 * point: PDPA 2010 asks for consent that was actually given, and a payload
 * that can omit it is a payload where the UI can forget to ask.
 */
export const createRegistration: MockHandler = ({ db, body, currentUser, now }) => {
  const candidateId = currentUser.candidateId;
  if (candidateId === null) {
    return notFound('Only a job seeker can register for a fair.');
  }

  const payload = isRecord(body) ? body : {};
  const fairId = payload['fairId'];
  const consent = payload['consent'];

  const errors: Record<string, readonly string[]> = {};
  if (typeof fairId !== 'string') {
    errors['fairId'] = ['The fair field is required.'];
  }
  if (consent !== true) {
    errors['consent'] = ['You must agree before registering.'];
  }
  if (Object.keys(errors).length > 0) {
    return validationError(errors);
  }

  const fair = db.fairs.find((entry) => entry.id === fairId);
  if (!fair) {
    return notFound('Fair not found.');
  }
  if (fair.status !== 'open' && fair.status !== 'live') {
    return conflict('Registration for this fair has closed.');
  }

  const duplicate = db.fairRegistrations.some(
    (entry) => entry.candidateId === candidateId && entry.fairId === fairId,
  );
  if (duplicate) {
    return conflict('You are already registered for this fair.');
  }

  const timestamp = new Date(now).toISOString();
  const registration: FairRegistration = {
    id: `reg-${candidateId}-${fairId}`,
    fairId: fair.id,
    candidateId,
    registeredAt: timestamp,
    consentedAt: timestamp,
  };
  db.fairRegistrations.push(registration);
  syncCandidateFairs(db.candidates, candidateId, db.fairRegistrations);

  return created(registration);
};

/** `DELETE /fair-registrations/{id}` — withdraw, only from your own. */
export const deleteRegistration: MockHandler = ({ db, params, currentUser }) => {
  const candidateId = currentUser.candidateId;
  const index = db.fairRegistrations.findIndex(
    (entry) => entry.id === params['id'] && entry.candidateId === candidateId,
  );

  // Someone else's registration reads as absent rather than forbidden: a 403
  // would confirm the id exists.
  if (index === -1) {
    return notFound('Registration not found.');
  }

  db.fairRegistrations.splice(index, 1);
  syncCandidateFairs(db.candidates, candidateId as string, db.fairRegistrations);

  return noContent();
};

/**
 * Keeps `Candidate.fairIds` in step with the registration rows.
 *
 * Two representations of one fact is a bad idea, but `fairIds` is what the
 * talent-pool filter and the seeded data already read, and a registration row
 * is what consent needs. The handler owning the sync keeps the duplication in
 * one place rather than at every call site.
 */
function syncCandidateFairs(
  candidates: Candidate[],
  candidateId: string,
  registrations: readonly FairRegistration[],
): void {
  const index = candidates.findIndex((candidate) => candidate.id === candidateId);
  if (index === -1) {
    return;
  }

  candidates[index] = {
    ...candidates[index],
    fairIds: registrations
      .filter((entry) => entry.candidateId === candidateId)
      .map((entry) => entry.fairId),
  };
}
