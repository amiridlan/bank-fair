import type { Environment } from './environment.model';

/** Development environment. Swapped in for `ng serve` and development builds. */
export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api',
  useMockApi: true,
};
