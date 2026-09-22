import type { User } from '../models';
import { type AuditRecord, recordAudit } from './audit';
import { matchRoute } from './handlers';
import { getMockDb } from './mock-db';
import { type MockResult, serverError } from './mock-response';

/**
 * Entry point for the mock backend, kept behind a dynamic import.
 *
 * Everything the mock needs — the route table, the handlers, the seed
 * generators and their word lists — hangs off this module. Importing it
 * statically from the interceptor put all of it in the initial bundle, so the
 * first page load carried 300 candidates' worth of names it had no use for.
 * Loading it on the first API call instead keeps it in a chunk of its own, and
 * the fetch is invisible behind the simulated latency.
 */
export interface MockRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly currentUser: User;
  readonly isProduction: boolean;
}

/** Stands in for a response when the id can only come from route params. */
const EMPTY_RESULT: MockResult = { status: 0, body: null };

function snapshot(record: AuditRecord | null): AuditRecord | null {
  return record ? { ...record } : null;
}

export function runMockRequest(request: MockRequest): MockResult {
  const match = matchRoute(request.method, request.path);

  if (!match) {
    if (!request.isProduction) {
      console.warn(`[mock-api] No handler for ${request.method} ${request.path}`);
    }
    return { status: 404, body: { message: 'Not found.' } };
  }

  const now = Date.now();

  // Snapshotted BEFORE the handler runs, and copied, because handlers replace
  // rows rather than mutating them — but a copy costs nothing and makes that
  // a property of this code rather than a promise made elsewhere.
  const before: AuditRecord | null =
    match.audit && request.method !== 'GET'
      ? snapshot(match.audit.find(getMockDb(), match.audit.idOf(match.params, EMPTY_RESULT) ?? ''))
      : null;

  try {
    const result = match.handler({
      method: request.method,
      path: request.path,
      params: match.params,
      query: request.query,
      body: request.body,
      db: getMockDb(),
      currentUser: request.currentUser,
      now,
    });

    if (match.audit) {
      // getMockDb() again, not the reference passed to the handler: POST
      // /demo/reset replaces the whole database, and the entry belongs in the
      // one that now exists rather than the one just discarded.
      recordAudit({
        db: getMockDb(),
        descriptor: match.audit,
        method: request.method,
        path: request.path,
        params: match.params,
        result,
        before,
        actor: request.currentUser,
        now,
      });
    }

    return result;
  } catch (error: unknown) {
    // A handler bug should look like a server fault, not crash the app.
    if (!request.isProduction) {
      console.error(`[mock-api] Handler threw for ${request.method} ${request.path}`, error);
    }
    return serverError();
  }
}
