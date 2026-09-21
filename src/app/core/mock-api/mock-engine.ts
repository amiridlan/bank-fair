import type { User } from '../models';
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

export function runMockRequest(request: MockRequest): MockResult {
  const match = matchRoute(request.method, request.path);

  if (!match) {
    if (!request.isProduction) {
      console.warn(`[mock-api] No handler for ${request.method} ${request.path}`);
    }
    return { status: 404, body: { message: 'Not found.' } };
  }

  try {
    return match.handler({
      method: request.method,
      path: request.path,
      params: match.params,
      query: request.query,
      body: request.body,
      db: getMockDb(),
      currentUser: request.currentUser,
      now: Date.now(),
    });
  } catch (error: unknown) {
    // A handler bug should look like a server fault, not crash the app.
    if (!request.isProduction) {
      console.error(`[mock-api] Handler threw for ${request.method} ${request.path}`, error);
    }
    return serverError();
  }
}
