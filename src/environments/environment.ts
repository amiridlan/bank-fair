import type { Environment } from './environment.model';

/**
 * Default environment, used by the production build.
 *
 * `environment.development.ts` replaces this file for the development
 * configuration (see `fileReplacements` in angular.json).
 *
 * Never put secrets, API keys or tokens in here — everything in this file is
 * shipped to the browser and readable by anyone.
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: '/api',

  /**
   * The deployed demo has no backend, so the mock API is on in production too.
   * Flip this to false once the Laravel 12 API exists (roadmap R1) — no feature
   * code changes, only `core/mock-api/` falls out of use.
   */
  useMockApi: true,
};
