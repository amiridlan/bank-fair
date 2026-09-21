import type { MockHandler } from '../mock-response';
import { assignBooth } from './booths.handler';
import { getCandidate, listCandidates } from './candidates.handler';
import { getDashboardSummary, resetDemo } from './dashboard.handler';
import {
  createEmployer,
  getEmployer,
  listEmployers,
  updateEmployer,
} from './employers.handler';
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
}

/**
 * Routes are matched in order, so more specific patterns come first:
 * `/fairs/:id/booths` must be tried before `/fairs/:id`.
 */
const ROUTES: readonly MockRoute[] = [
  { method: 'GET', pattern: '/dashboard/summary', handler: getDashboardSummary },

  { method: 'GET', pattern: '/fairs/:id/booths', handler: listFairBooths },
  { method: 'GET', pattern: '/fairs/:id', handler: getFair },
  { method: 'GET', pattern: '/fairs', handler: listFairs },

  { method: 'PATCH', pattern: '/booths/:id', handler: assignBooth },

  { method: 'GET', pattern: '/employers/:id', handler: getEmployer },
  { method: 'GET', pattern: '/employers', handler: listEmployers },
  { method: 'POST', pattern: '/employers', handler: createEmployer },
  { method: 'PATCH', pattern: '/employers/:id', handler: updateEmployer },

  { method: 'GET', pattern: '/candidates/:id', handler: getCandidate },
  { method: 'GET', pattern: '/candidates', handler: listCandidates },

  { method: 'GET', pattern: '/shortlists', handler: listShortlists },
  { method: 'POST', pattern: '/shortlists', handler: createShortlist },
  { method: 'DELETE', pattern: '/shortlists/:id', handler: deleteShortlist },

  { method: 'GET', pattern: '/fair-registrations', handler: listRegistrations },
  { method: 'POST', pattern: '/fair-registrations', handler: createRegistration },
  { method: 'DELETE', pattern: '/fair-registrations/:id', handler: deleteRegistration },
  { method: 'GET', pattern: '/interview-slots', handler: listInterviewSlots },
  { method: 'PATCH', pattern: '/interview-slots/:id', handler: updateInterviewSlot },

  { method: 'POST', pattern: '/demo/reset', handler: resetDemo },
];

export interface RouteMatch {
  readonly handler: MockHandler;
  readonly params: Readonly<Record<string, string>>;
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
      return { handler: route.handler, params };
    }
  }
  return null;
}
