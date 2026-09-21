import type { Booth, Fair } from '../../models';
import { type MockHandler, conflict, notFound, ok } from '../mock-response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keeps `boothAssigned` in step so the dashboard and floor plan agree. */
function recountFair(fairs: Fair[], booths: readonly Booth[], fairId: string): void {
  const index = fairs.findIndex((fair) => fair.id === fairId);
  if (index < 0) {
    return;
  }

  const assigned = booths.filter(
    (booth) => booth.fairId === fairId && booth.employerId !== null,
  ).length;

  fairs[index] = { ...fairs[index], boothAssigned: assigned };
}

/**
 * `PATCH /booths/{id}` with `{ employer_id, force? }`.
 *
 * Assigning to an occupied booth is a 409 unless `force` is set — the UI turns
 * that into a "Replace X with Y?" confirmation rather than silently
 * overwriting someone's booking. Passing `employer_id: null` clears the booth,
 * which is how Undo works.
 */
export const assignBooth: MockHandler = ({ db, params, body }) => {
  const index = db.booths.findIndex((booth) => booth.id === params['id']);
  if (index < 0) {
    return notFound('Booth not found.');
  }

  const booth = db.booths[index];
  const payload = isRecord(body) ? body : {};
  const employerId = payload['employerId'];
  const force = payload['force'] === true;

  if (employerId === null || employerId === undefined) {
    db.booths[index] = { ...booth, employerId: null, employerName: null };
    recountFair(db.fairs, db.booths, booth.fairId);
    return ok(db.booths[index]);
  }

  if (typeof employerId !== 'string') {
    return notFound('Employer not found.');
  }

  const employer = db.employers.find((candidate) => candidate.id === employerId);
  if (!employer) {
    return notFound('Employer not found.');
  }

  if (booth.employerId !== null && booth.employerId !== employerId && !force) {
    return conflict(`${booth.employerName} already has booth ${booth.code}.`);
  }

  // An employer holds one booth per fair, so clear any previous one.
  for (let i = 0; i < db.booths.length; i++) {
    const other = db.booths[i];
    if (other.fairId === booth.fairId && other.employerId === employerId && other.id !== booth.id) {
      db.booths[i] = { ...other, employerId: null, employerName: null };
    }
  }

  db.booths[index] = { ...booth, employerId, employerName: employer.name };
  recountFair(db.fairs, db.booths, booth.fairId);

  return ok(db.booths[index]);
};
