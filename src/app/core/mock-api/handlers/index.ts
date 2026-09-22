import type { AuditDescriptor, AuditRecord } from '../audit';
import { resultData } from '../audit';
import type { MockDb } from '../mock-db';
import type { MockHandler } from '../mock-response';
import { listAuditEntries } from './audit.handler';
import { assignBooth } from './booths.handler';
import { getCandidate, listCandidates, updateCandidate } from './candidates.handler';
import { getDashboardSummary, resetDemo } from './dashboard.handler';
import {
  createEmployer,
  getEmployer,
  listEmployers,
  updateEmployer,
} from './employers.handler';
import {
  createApplication,
  decideApplication,
  listApplications,
} from './applications.handler';
import {
  createRegistration,
  deleteRegistration,
  listRegistrations,
} from './registrations.handler';
import {
  createShortlist,
  deleteShortlist,
  listInterviewSlots,
  listShortlists,
  updateInterviewSlot,
} from './engagements.handler';
import { getFair, listFairBooths, listFairs } from './fairs.handler';

interface MockRoute {
  readonly method: string;
  /** Path pattern with `:name` placeholders, e.g. `/fairs/:id/booths`. */
  readonly pattern: string;
  readonly handler: MockHandler;
  /**
   * How to log this write (docs/09 A3). Required on every non-GET route —
   * `handlers.spec.ts` asserts it, so a new write endpoint cannot ship
   * silently unlogged.
   */
  readonly audit?: AuditDescriptor;
}

/** Looks a row up by id in one of the database's tables. */
function byId<T extends { id: string }>(table: (db: MockDb) => T[]) {
  return (db: MockDb, id: string): AuditRecord | null =>
    (table(db).find((row) => row.id === id) as AuditRecord | undefined) ?? null;
}

/** The id from a route param — updates and deletes. */
const idFromParams = (params: Readonly<Record<string, string>>): string | null =>
  params['id'] ?? null;

/** The id from the response — creates, where it does not exist until after. */
const idFromResult = (
  _params: Readonly<Record<string, string>>,
  result: { status: number; body: unknown },
): string | null => {
  const id = resultData(result)?.['id'];
  return typeof id === 'string' ? id : null;
};

function text(record: AuditRecord, field: string): string | null {
  const value = record[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

const EMPLOYER_AUDIT: AuditDescriptor = {
  entity: 'employer',
  find: byId((db) => db.employers),
  idOf: idFromParams,
  label: (record) => text(record, 'name') ?? 'Employer',
};

const BOOTH_AUDIT: AuditDescriptor = {
  entity: 'booth',
  find: byId((db) => db.booths),
  idOf: idFromParams,
  label: (record) => {
    const code = text(record, 'code');
    return code ? `Booth ${code}` : 'Booth';
  },
  // "updated" would hide the only thing anyone wants from a floor-plan log.
  action: (_before, after) => (after?.['employerId'] ? 'assigned' : 'cleared'),
};

const CANDIDATE_AUDIT: AuditDescriptor = {
  entity: 'candidate',
  find: byId((db) => db.candidates),
  idOf: idFromParams,
  // The id, not the name: a candidate's name is personal data, and the log
  // does not record it (L2). The id is enough to find them.
  label: (record) => `Candidate ${text(record, 'id') ?? ''}`.trim(),
};

const SHORTLIST_AUDIT: AuditDescriptor = {
  entity: 'shortlist',
  find: byId((db) => db.shortlists),
  idOf: (params, result) => idFromParams(params) ?? idFromResult(params, result),
  label: (record) => `Shortlist for candidate ${text(record, 'candidateId') ?? ''}`.trim(),
};

const APPLICATION_AUDIT: AuditDescriptor = {
  entity: 'fair-application',
  find: byId((db) => db.fairApplications),
  idOf: (params, result) => idFromParams(params) ?? idFromResult(params, result),
  label: (record) => text(record, 'employerName') ?? 'Application',
  action: (_before, after) => {
    const status = after?.['status'];
    return status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : null;
  },
};

const REGISTRATION_AUDIT: AuditDescriptor = {
  entity: 'fair-registration',
  find: byId((db) => db.fairRegistrations),
  idOf: (params, result) => idFromParams(params) ?? idFromResult(params, result),
  label: (record, db) => {
    const fair = db.fairs.find((entry) => entry.id === record['fairId']);
    return fair ? `Registration for ${fair.name}` : 'Fair registration';
  },
};

const INTERVIEW_AUDIT: AuditDescriptor = {
  entity: 'interview-slot',
  find: byId((db) => db.interviewSlots),
  idOf: idFromParams,
  label: (record) => {
    const start = text(record, 'startTime');
    return start ? `Interview slot at ${start}` : 'Interview slot';
  },
  action: (_before, after) => (after?.['candidateId'] ? 'booked' : 'cancelled'),
};

/**
 * The reset is logged into the database it just created, so the API's rule —
 * every write is recorded — holds without an exemption.
 *
 * In the app the entry does not survive: Settings reloads the page after a
 * reset, and the whole mock database lives in memory, so the reload discards
 * the log along with everything else. The Activity view says so rather than
 * showing an unexplained empty list. If the reset ever stops reloading, this
 * entry is already correct.
 */
const DEMO_RESET_AUDIT: AuditDescriptor = {
  entity: 'demo',
  find: () => ({ id: 'demo' }),
  idOf: () => 'demo',
  label: () => 'Demo data',
  action: () => 'reset',
};

/**
 * Routes are matched in order, so more specific patterns come first:
 * `/fairs/:id/booths` must be tried before `/fairs/:id`.
 */
const ROUTES: readonly MockRoute[] = [
  { method: 'GET', pattern: '/dashboard/summary', handler: getDashboardSummary },
  { method: 'GET', pattern: '/audit-entries', handler: listAuditEntries },

  { method: 'GET', pattern: '/fairs/:id/booths', handler: listFairBooths },
  { method: 'GET', pattern: '/fairs/:id', handler: getFair },
  { method: 'GET', pattern: '/fairs', handler: listFairs },

  { method: 'PATCH', pattern: '/booths/:id', handler: assignBooth, audit: BOOTH_AUDIT },

  { method: 'GET', pattern: '/employers/:id', handler: getEmployer },
  { method: 'GET', pattern: '/employers', handler: listEmployers },
  { method: 'POST', pattern: '/employers', handler: createEmployer, audit: { ...EMPLOYER_AUDIT, idOf: idFromResult } },
  { method: 'PATCH', pattern: '/employers/:id', handler: updateEmployer, audit: EMPLOYER_AUDIT },

  { method: 'GET', pattern: '/candidates/:id', handler: getCandidate },
  { method: 'PATCH', pattern: '/candidates/:id', handler: updateCandidate, audit: CANDIDATE_AUDIT },
  { method: 'GET', pattern: '/candidates', handler: listCandidates },

  { method: 'GET', pattern: '/shortlists', handler: listShortlists },
  { method: 'POST', pattern: '/shortlists', handler: createShortlist, audit: SHORTLIST_AUDIT },
  { method: 'DELETE', pattern: '/shortlists/:id', handler: deleteShortlist, audit: SHORTLIST_AUDIT },

  { method: 'GET', pattern: '/fair-applications', handler: listApplications },
  { method: 'POST', pattern: '/fair-applications', handler: createApplication, audit: APPLICATION_AUDIT },
  { method: 'PATCH', pattern: '/fair-applications/:id', handler: decideApplication, audit: APPLICATION_AUDIT },
  { method: 'GET', pattern: '/fair-registrations', handler: listRegistrations },
  { method: 'POST', pattern: '/fair-registrations', handler: createRegistration, audit: REGISTRATION_AUDIT },
  { method: 'DELETE', pattern: '/fair-registrations/:id', handler: deleteRegistration, audit: REGISTRATION_AUDIT },
  { method: 'GET', pattern: '/interview-slots', handler: listInterviewSlots },
  { method: 'PATCH', pattern: '/interview-slots/:id', handler: updateInterviewSlot, audit: INTERVIEW_AUDIT },

  { method: 'POST', pattern: '/demo/reset', handler: resetDemo, audit: DEMO_RESET_AUDIT },
];

export interface RouteMatch {
  readonly handler: MockHandler;
  readonly params: Readonly<Record<string, string>>;
  readonly audit?: AuditDescriptor;
}

/** Every route that writes. Used by the spec to assert each one is logged. */
export function writeRoutes(): readonly { method: string; pattern: string; audited: boolean }[] {
  return ROUTES.filter((route) => route.method !== 'GET').map((route) => ({
    method: route.method,
    pattern: route.pattern,
    audited: route.audit !== undefined,
  }));
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i];
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (expected !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/** Finds the handler for a method and path, or null when nothing matches. */
export function matchRoute(method: string, path: string): RouteMatch | null {
  for (const route of ROUTES) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPattern(route.pattern, path);
    if (params) {
      return { handler: route.handler, params, audit: route.audit };
    }
  }
  return null;
}
