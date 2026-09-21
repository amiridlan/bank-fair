/**
 * Shape shared by every environment file.
 *
 * It lives in its own module on purpose. `angular.json` replaces
 * `environment.ts` with `environment.development.ts` for development builds, so
 * if the type were declared in `environment.ts` the development file would end
 * up importing its own replacement and the type would vanish.
 */
export interface Environment {
  /** True only in the production build. Gates dev-only logging. */
  readonly production: boolean;
  /** Prefixed onto every relative request path by `baseUrlInterceptor`. */
  readonly apiBaseUrl: string;
  /** When true, `mockApiInterceptor` serves requests from the in-memory DB. */
  readonly useMockApi: boolean;
}
