import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalised error shape every store and component works with, so nothing
 * downstream has to know about `HttpErrorResponse`.
 */
export interface ApiError {
  readonly status: number;
  /** Safe to show a user: never a raw stack trace or error code. */
  readonly message: string;
  /** Laravel 422 field errors, keyed by camelCased field name. Empty otherwise. */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
}

const DEFAULT_MESSAGE = 'Something went wrong. Try again.';

/** Status 0 means the request never reached a server (offline, DNS, CORS). */
const OFFLINE_MESSAGE = 'Could not reach the server. Check your connection and retry.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMessage(body: unknown): string | null {
  if (isRecord(body) && typeof body['message'] === 'string' && body['message'].length > 0) {
    return body['message'];
  }
  return null;
}

/**
 * Laravel's 422 body is `{ message, errors: { field: string[] } }`. Keys arrive
 * snake_case; they are camelCased here so a form can look them up by control
 * name without converting at each call site.
 */
function readFieldErrors(body: unknown): Record<string, readonly string[]> {
  if (!isRecord(body) || !isRecord(body['errors'])) {
    return {};
  }

  const result: Record<string, readonly string[]> = {};
  for (const [field, messages] of Object.entries(body['errors'])) {
    if (Array.isArray(messages)) {
      const strings = messages.filter((m): m is string => typeof m === 'string');
      if (strings.length > 0) {
        result[snakeToCamel(field)] = strings;
      }
    }
  }
  return result;
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Maps anything thrown by `HttpClient` — or by our own code — into an
 * `ApiError`. Never throws, so error handling paths cannot themselves fail.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const status = error.status;
    const message =
      status === 0 ? OFFLINE_MESSAGE : (readMessage(error.error) ?? error.message ?? DEFAULT_MESSAGE);

    return {
      status,
      message,
      fieldErrors: readFieldErrors(error.error),
    };
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message || DEFAULT_MESSAGE, fieldErrors: {} };
  }

  return { status: 0, message: DEFAULT_MESSAGE, fieldErrors: {} };
}

/** 422 means the payload was rejected field by field; show it on the form. */
export function isValidationError(error: ApiError): boolean {
  return error.status === 422;
}
