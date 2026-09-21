import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlTree, provideRouter } from '@angular/router';

import { AuthStore } from './auth.store';
import { roleGuard, roleHomeRedirectGuard } from './role.guard';

const ROUTE: Route = { path: '' };
/** These guards decide on role alone, so the snapshot argument is unused. */
const SNAPSHOT = {} as Parameters<CanMatchFn>[2];

/**
 * Guards are plain functions but must run inside an injection context, so each
 * assertion goes through `TestBed.runInInjectionContext`.
 */
function runGuard(guard: CanMatchFn): boolean | UrlTree {
  return TestBed.runInInjectionContext(() => guard(ROUTE, [], SNAPSHOT)) as boolean | UrlTree;
}

describe('roleGuard', () => {
  let auth: AuthStore;
  let router: Router;

  beforeEach(() => {
    // AuthStore persists the demo identity to sessionStorage, which outlives
    // a TestBed, so without this each test inherits the previous one's user.
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  it('lets the matching role through', () => {
    auth.switchUser('u-staff-1');

    expect(runGuard(roleGuard('staff'))).toBe(true);
  });

  it('redirects a hiring manager away from the staff section', () => {
    auth.switchUser('u-hm-1');

    const result = runGuard(roleGuard('staff'));

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/hiring/talent-pool');
  });

  it('redirects staff away from the hiring section', () => {
    auth.switchUser('u-staff-1');

    const result = runGuard(roleGuard('hiring_manager'));

    expect(router.serializeUrl(result as UrlTree)).toBe('/staff/dashboard');
  });

  it('sends the root path to the current role home', () => {
    auth.switchUser('u-hm-2');

    const result = runGuard(roleHomeRedirectGuard);

    expect(router.serializeUrl(result as UrlTree)).toBe('/hiring/talent-pool');
  });
});

describe('AuthStore', () => {
  let auth: AuthStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthStore);
  });

  it('defaults to the staff user', () => {
    expect(auth.role()).toBe('staff');
    expect(auth.employerId()).toBeNull();
  });

  it('exposes the employer a hiring manager acts for', () => {
    auth.switchUser('u-hm-1');

    expect(auth.isHiringManager()).toBe(true);
    expect(auth.employerId()).toBe('emp-001');
  });

  it('ignores an unknown user id', () => {
    auth.switchUser('u-does-not-exist');

    expect(auth.user().id).toBe('u-staff-1');
  });

  it('clears the active fair when the identity changes', () => {
    auth.switchUser('u-hm-1');
    auth.setActiveFair('fair-02');
    expect(auth.activeFairId()).toBe('fair-02');

    // fair-02 means nothing to a different employer.
    auth.switchUser('u-hm-2');
    expect(auth.activeFairId()).toBeNull();
  });

  describe('persistence', () => {
    // The identity has to survive a reload, or the role guard sends every
    // refresh of a /hiring route back to the staff dashboard, and a shared
    // link to one never works (docs/07 UX-2).
    function reload(): AuthStore {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      return TestBed.inject(AuthStore);
    }

    it('restores the chosen identity on reload', () => {
      auth.switchUser('u-hm-2');

      expect(reload().user().id).toBe('u-hm-2');
    });

    it('restores the active fair too, so a reload books against the same one', () => {
      auth.switchUser('u-hm-1');
      auth.setActiveFair('fair-03');

      expect(reload().activeFairId()).toBe('fair-03');
    });

    it('forgets the active fair when the identity changes', () => {
      auth.switchUser('u-hm-1');
      auth.setActiveFair('fair-03');
      auth.switchUser('u-hm-2');

      expect(reload().activeFairId()).toBeNull();
    });

    it('falls back to staff for a stale or tampered id', () => {
      sessionStorage.setItem('fo-demo-user', 'u-was-removed');

      expect(reload().user().id).toBe('u-staff-1');
    });

    it('still works when storage throws', () => {
      // Private windows and blocked site data both throw here. Losing the
      // convenience is fine; failing to construct the store is not.
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.getItem = () => {
        throw new Error('blocked');
      };
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };

      try {
        const store = reload();
        expect(store.user().id).toBe('u-staff-1');
        expect(() => store.switchUser('u-hm-1')).not.toThrow();
        expect(store.user().id).toBe('u-hm-1');
      } finally {
        Storage.prototype.getItem = getItem;
        Storage.prototype.setItem = setItem;
      }
    });
  });
});
