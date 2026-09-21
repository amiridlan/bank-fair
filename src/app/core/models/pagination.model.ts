/** Mirrors a Laravel API Resource collection, converted to camelCase. */
export interface PaginationMeta {
  readonly currentPage: number;
  readonly perPage: number;
  readonly total: number;
  readonly lastPage: number;
}

export interface Paginated<T> {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
}

/** Envelope for a single resource: `{ "data": { ... } }`. */
export interface SingleResource<T> {
  readonly data: T;
}
