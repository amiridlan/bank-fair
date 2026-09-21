import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import type { Paginated, SingleResource } from '../models';
import { camelToSnakeKey, toCamelCase, toSnakeCase } from './case-conversion';

/** Query parameter values a caller may pass. `null`/`undefined` are dropped. */
export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

/**
 * Thin typed wrapper over `HttpClient`.
 *
 * Its whole job is the API boundary: unwrap Laravel's `{ data, meta }`
 * envelopes and convert between the wire's snake_case and the app's camelCase.
 * Stores call this; components never do.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** `GET` returning a single resource, unwrapped from its `data` envelope. */
  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<unknown>(path, { params: this.toHttpParams(params) })
      .pipe(map((body) => toCamelCase<SingleResource<T>>(body).data));
  }

  /**
   * `GET` returning a collection. Always resolves to a `Paginated<T>`: an
   * unpaginated endpoint gets synthetic meta so callers need only one shape.
   */
  getList<T>(path: string, params?: QueryParams): Observable<Paginated<T>> {
    return this.http
      .get<unknown>(path, { params: this.toHttpParams(params) })
      .pipe(map((body) => this.toPaginated<T>(body)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<unknown>(path, toSnakeCase(body))
      .pipe(map((res) => toCamelCase<SingleResource<T>>(res).data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<unknown>(path, toSnakeCase(body))
      .pipe(map((res) => toCamelCase<SingleResource<T>>(res).data));
  }

  /** `DELETE`. Endpoints return 204 with no body, so this resolves to void. */
  delete(path: string): Observable<void> {
    return this.http.delete<void>(path).pipe(map(() => undefined));
  }

  private toPaginated<T>(body: unknown): Paginated<T> {
    const converted = toCamelCase<{ data?: readonly T[]; meta?: Paginated<T>['meta'] }>(body);
    const data = converted.data ?? [];

    return {
      data,
      meta: converted.meta ?? {
        currentPage: 1,
        perPage: data.length,
        total: data.length,
        lastPage: 1,
      },
    };
  }

  /**
   * Callers pass camelCase keys; the wire wants snake_case (`min_cgpa`,
   * `per_page`). `null`, `undefined` and `''` are dropped so an unset filter is
   * absent from the URL rather than sent as the string "null".
   */
  private toHttpParams(params?: QueryParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(camelToSnakeKey(key), String(value));
      }
    }
    return httpParams;
  }
}
