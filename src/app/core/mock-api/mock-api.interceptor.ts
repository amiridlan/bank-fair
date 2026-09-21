import {
  HttpErrorResponse,
  type HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, switchMap, throwError, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';
import { toCamelCase, toSnakeCase } from '../http/case-conversion';
import { DemoSettingsService, SIMULATED_ERROR_RATE } from './demo-settings.service';
import { matchRoute } from './handlers';
import { getMockDb } from './mock-db';
import { type MockResult, serverError } from './mock-response';

/** Network latency, so loading states are real rather than theoretical. */
const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 800;

function randomLatency(): number {
  return MIN_LATENCY_MS + Math.floor(Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS));
}

/**
 * Serves every request from the in-memory database.
 *
 * It is an interceptor rather than a fake service on purpose: features call
 * `HttpClient` exactly as they will against Laravel, so swapping backends is a
 * flag change and nothing in `features/` is touched. It is also why the error
 * path is real — failures come back as `HttpErrorResponse`, so `errorInterceptor`
 * and every store's error handling are genuinely exercised.
 *
 * Registered last in the chain so it short-circuits the request without
 * bypassing the interceptors above it.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const demoSettings = inject(DemoSettingsService);

  const url = new URL(req.urlWithParams, 'http://mock.local');
  const prefix = environment.apiBaseUrl;

  // Anything outside the API base URL is somebody else's request.
  if (!url.pathname.startsWith(prefix)) {
    return next(req);
  }

  const path = url.pathname.slice(prefix.length) || '/';
  const match = matchRoute(req.method, path);

  if (!match) {
    if (!environment.production) {
      console.warn(`[mock-api] No handler for ${req.method} ${path}`);
    }
    return respond({ status: 404, body: { message: 'Not found.' } }, req.url);
  }

  // Reset is exempt: it is the way out of a broken-looking demo, so it must
  // not itself be randomly broken.
  if (demoSettings.simulateErrors() && path !== '/demo/reset' && Math.random() < SIMULATED_ERROR_RATE) {
    return respond(serverError(), req.url);
  }

  let result: MockResult;
  try {
    result = match.handler({
      method: req.method,
      path,
      params: match.params,
      query: url.searchParams,
      // Handlers work in camelCase; the wire is snake_case both ways.
      body: req.body === null ? null : toCamelCase(req.body),
      db: getMockDb(),
      currentUser: auth.user(),
      now: Date.now(),
    });
  } catch (error: unknown) {
    // A handler bug should look like a server fault, not crash the app.
    if (!environment.production) {
      console.error(`[mock-api] Handler threw for ${req.method} ${path}`, error);
    }
    result = serverError();
  }

  return respond(result, req.url);
};

function respond(result: MockResult, url: string): Observable<HttpEvent<unknown>> {
  const body = result.body === null ? null : toSnakeCase(result.body);

  // `delay` only defers next notifications — an error would otherwise arrive
  // instantly, and a failure that returns faster than a success is not a
  // realistic network. Delaying a value first, then switching to the error,
  // gives both paths the same latency.
  return timer(randomLatency()).pipe(
    switchMap(() => {
      if (result.status >= 400) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: result.status,
              statusText: 'Mock Error',
              error: body,
              url,
            }),
        );
      }

      return of(new HttpResponse({ status: result.status, body, url }));
    }),
  );
}
