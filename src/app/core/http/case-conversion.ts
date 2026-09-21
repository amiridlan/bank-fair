/**
 * snake_case <-> camelCase conversion for the API boundary.
 *
 * The wire format is snake_case because the future Laravel 12 API serialises
 * that way. Converting in exactly one place (`ApiService`) keeps every model
 * and component idiomatic TypeScript, and means switching to the real backend
 * changes no feature code.
 */

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const SNAKE_BOUNDARY = /_([a-z0-9])/g;
const CAMEL_BOUNDARY = /[A-Z]/g;

export function snakeToCamelKey(key: string): string {
  return key.replace(SNAKE_BOUNDARY, (_match, char: string) => char.toUpperCase());
}

export function camelToSnakeKey(key: string): string {
  return key.replace(CAMEL_BOUNDARY, (char) => `_${char.toLowerCase()}`);
}

/**
 * `Date` and `File` are passed through untouched: recursing into them would
 * turn a `Date` into `{}` and corrupt an upload.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof File) &&
    !(value instanceof Blob)
  );
}

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => convertKeys(item, convert));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[convert(key)] = convertKeys(val, convert);
    }
    return result;
  }

  return value;
}

/** Converts an incoming API payload's keys to camelCase, recursively. */
export function toCamelCase<T>(value: unknown): T {
  return convertKeys(value, snakeToCamelKey) as T;
}

/** Converts an outgoing request body's keys to snake_case, recursively. */
export function toSnakeCase(value: unknown): unknown {
  return convertKeys(value, camelToSnakeKey);
}
