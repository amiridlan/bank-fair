import type { User } from '../models';
import type { MockDb } from './mock-db';

/** Everything a handler needs to answer one request. */
export interface MockContext {
  readonly method: string;
  /** Path with the `/api` prefix removed, e.g. `/fairs/fair-01`. */
  readonly path: string;
  /** Route parameters captured from the pattern, e.g. `{ id: 'fair-01' }`. */
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  /** Request body, already converted to camelCase. */
  readonly body: unknown;
  readonly db: MockDb;
  /**
   * Who is asking. In Laravel this comes from the authenticated user; here it
   * comes from `AuthStore`, which is what decides whether contact details are
   * masked.
   */
  readonly currentUser: User;
  readonly now: number;
}

/** A handler's answer, in camelCase. The interceptor snake_cases it. */
export interface MockResult {
  readonly status: number;
  readonly body: unknown;
}

export type MockHandler = (context: MockContext) => MockResult;

/** 200 with a single resource, wrapped in Laravel's `data` envelope. */
export function ok(data: unknown): MockResult {
  return { status: 200, body: { data } };
}

/** 200 with a collection plus pagination meta. */
export function okList<T>(
  items: readonly T[],
  meta?: { currentPage: number; perPage: number; total: number; lastPage: number },
): MockResult {
  return { status: 200, body: meta ? { data: items, meta } : { data: items } };
}

export function created(data: unknown): MockResult {
  return { status: 201, body: { data } };
}

export function noContent(): MockResult {
  return { status: 204, body: null };
}

export function notFound(message: string): MockResult {
  return { status: 404, body: { message } };
}

/** 409. Used for a taken slot, an occupied booth, or a duplicate shortlist. */
export function conflict(message: string): MockResult {
  return { status: 409, body: { message } };
}

/**
 * 422 in Laravel's shape. Field keys are camelCase here and snake_cased on the
 * way out, which is the same round trip a real response makes.
 */
export function validationError(errors: Readonly<Record<string, readonly string[]>>): MockResult {
  const firstMessage = Object.values(errors)[0]?.[0] ?? 'The given data was invalid.';
  return { status: 422, body: { message: firstMessage, errors } };
}

export function serverError(message = 'Something went wrong on our side.'): MockResult {
  return { status: 500, body: { message } };
}

// --------------------------------------------------------------- pagination

export interface PageRequest {
  readonly page: number;
  readonly perPage: number;
}

/** Reads `page` and `per_page`, clamped so a hostile value cannot break a view. */
export function readPageRequest(query: URLSearchParams, defaultPerPage = 20): PageRequest {
  const page = Math.max(1, Number(query.get('page') ?? '1') || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(query.get('per_page') ?? String(defaultPerPage)) || defaultPerPage),
  );
  return { page, perPage };
}

/** Slices a list and returns it with the matching meta. */
export function paginate<T>(items: readonly T[], request: PageRequest): MockResult {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / request.perPage));
  const start = (request.page - 1) * request.perPage;

  return okList(items.slice(start, start + request.perPage), {
    currentPage: request.page,
    perPage: request.perPage,
    total,
    lastPage,
  });
}
