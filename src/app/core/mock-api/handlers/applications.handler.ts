import type { Employer, FairApplication } from '../../models';
import { PACKAGE_PRICE_MYR } from '../seed/seed-employers';
import {
  type MockHandler,
  conflict,
  created,
  notFound,
  ok,
  okList,
  validationError,
} from '../mock-response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `GET /fair-applications` — staff see every application, an employer sees
 * only their own.
 *
 * The scoping is by who is asking, not by a parameter, so there is no way to
 * request somebody else's.
 */
export const listApplications: MockHandler = ({ db, query, currentUser }) => {
  const status = query.get('status');

  const rows =
    currentUser.role === 'staff'
      ? db.fairApplications
      : db.fairApplications.filter((entry) => entry.employerId === currentUser.employerId);

  return okList(status ? rows.filter((entry) => entry.status === status) : rows);
};

/** `POST /fair-applications` — an employer applies; it lands pending. */
export const createApplication: MockHandler = ({ db, body, currentUser, now }) => {
  const employerId = currentUser.employerId;
  if (employerId === null) {
    return notFound('Only an employer can apply to attend a fair.');
  }

  const payload = isRecord(body) ? body : {};
  const fairId = payload['fairId'];
  if (typeof fairId !== 'string') {
    return validationError({ fairId: ['The fair field is required.'] });
  }

  const fair = db.fairs.find((entry) => entry.id === fairId);
  if (!fair) {
    return notFound('Fair not found.');
  }
  if (fair.status !== 'open' && fair.status !== 'live') {
    return conflict('Applications for this fair have closed.');
  }

  // A rejected application can be resubmitted; a pending or approved one
  // cannot, or staff would review the same request twice.
  const existing = db.fairApplications.find(
    (entry) =>
      entry.employerId === employerId && entry.fairId === fairId && entry.status !== 'rejected',
  );
  if (existing) {
    return conflict(
      existing.status === 'approved'
        ? 'You are already attending this fair.'
        : 'Your application for this fair is already being reviewed.',
    );
  }

  const employer = db.employers.find((entry) => entry.id === employerId);
  const application: FairApplication = {
    id: `app-${employerId}-${fairId}-${db.fairApplications.length}`,
    fairId,
    employerId,
    employerName: employer?.name ?? 'Unknown employer',
    status: 'pending',
    appliedAt: new Date(now).toISOString(),
    decidedAt: null,
    rejectionReason: null,
  };
  db.fairApplications.push(application);

  return created(application);
};

/**
 * `PATCH /fair-applications/{id}` — staff approve or reject.
 *
 * Approving adds the fair to the employer's `fairIds` and advances their
 * pipeline stage to `confirmed`. That second half is what makes them
 * assignable to a booth: the floor plan offers only `confirmed` and `paid`
 * employers, so an approval that left a lead a lead would be a rubber stamp.
 */
export const decideApplication: MockHandler = ({ db, params, body, currentUser, now }) => {
  if (currentUser.role !== 'staff') {
    return notFound('Only staff can decide an application.');
  }

  const index = db.fairApplications.findIndex((entry) => entry.id === params['id']);
  if (index === -1) {
    return notFound('Application not found.');
  }

  const payload = isRecord(body) ? body : {};
  const status = payload['status'];
  const reason = payload['rejectionReason'];

  if (status !== 'approved' && status !== 'rejected') {
    return validationError({ status: ['Status must be approved or rejected.'] });
  }
  // A rejection without a reason leaves the employer guessing, so the API
  // will not accept one.
  if (status === 'rejected' && (typeof reason !== 'string' || reason.trim() === '')) {
    return validationError({ rejectionReason: ['A reason is required when rejecting.'] });
  }

  const current = db.fairApplications[index];
  if (current.status !== 'pending') {
    return conflict('This application has already been decided.');
  }

  const decided: FairApplication = {
    ...current,
    status,
    decidedAt: new Date(now).toISOString(),
    rejectionReason: status === 'rejected' ? (reason as string).trim() : null,
  };
  db.fairApplications[index] = decided;

  if (status === 'approved') {
    acceptEmployer(db.employers, current.employerId, current.fairId);
  }

  return ok(decided);
};

/**
 * Puts an approved employer on the fair and moves them to `confirmed`.
 *
 * `paid` is further along than `confirmed`, so it is never walked back — an
 * employer who has already paid for one fair does not lose that by being
 * accepted for another. Approving a previously `lost` employer revives them,
 * which is why `lostReason` is cleared: the model requires it to be null for
 * every stage but `lost`.
 */
function acceptEmployer(employers: Employer[], employerId: string, fairId: string): void {
  const index = employers.findIndex((employer) => employer.id === employerId);
  if (index === -1) {
    return;
  }

  const current = employers[index];
  const stage = current.stage === 'paid' ? 'paid' : 'confirmed';

  employers[index] = {
    ...current,
    fairIds: current.fairIds.includes(fairId) ? current.fairIds : [...current.fairIds, fairId],
    stage,
    lostReason: null,
    // Mirrors `PATCH /employers/{id}`: confirmed and paid both carry the
    // package price, and a deal value without a package would be invented.
    dealValueMyr:
      current.boothPackage !== null ? PACKAGE_PRICE_MYR[current.boothPackage] : null,
  };
}
