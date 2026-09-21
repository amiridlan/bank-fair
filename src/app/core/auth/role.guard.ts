import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import type { Role } from '../models';
import { AuthStore } from './auth.store';

/**
 * Blocks a role from the other role's section and sends it home instead.
 *
 * `CanMatchFn` rather than `CanActivateFn` so a blocked branch never matches —
 * which also stops the router downloading that feature's lazy chunk.
 *
 * DEMO ONLY: this is navigation convenience, not authorisation. Laravel
 * policies enforce access for real (roadmap R2).
 */
export function roleGuard(allowed: Role): CanMatchFn {
  return () => {
    const auth = inject(AuthStore);
    const router = inject(Router);

    if (auth.role() === allowed) {
      return true;
    }

    return router.parseUrl(auth.homeRoute());
  };
}

/** Sends the bare `/` path to whichever home the current role uses. */
export const roleHomeRedirectGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  return router.parseUrl(auth.homeRoute());
};
