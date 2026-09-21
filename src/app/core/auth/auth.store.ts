import { Injectable, computed, signal } from '@angular/core';

import type { Role, User } from '../models';

/**
 * ============================ DEMO ONLY — NOT SECURITY ============================
 *
 * This store fakes authentication so the portfolio demo can switch between a
 * staff user and two hiring managers from the top bar. It is client-side state
 * and anything in the browser can be changed by whoever is using it.
 *
 * Real authentication and authorisation arrive with Laravel Sanctum (roadmap
 * R2): SPA cookie auth, and server-side policies that decide what each role may
 * see. Treat nothing here as a security boundary.
 *
 * =================================================================================
 */

/** The fixed demo cast. Ids match the seed data in docs/05-mock-data.md. */
export const DEMO_USERS: readonly User[] = [
  { id: 'u-staff-1', name: 'Farah Iskandar', role: 'staff', employerId: null, candidateId: null },
  { id: 'u-emp-1', name: 'Daniel Lim', role: 'employer', employerId: 'emp-001', candidateId: null },
  { id: 'u-emp-2', name: 'Priya Nair', role: 'employer', employerId: 'emp-002', candidateId: null },
  // Mapped onto a seeded candidate rather than a fourth invented person, so
  // the job seeker's profile is the same record employers browse.
  {
    id: 'u-seeker-1',
    name: 'Ahmad Zaki Abdullah Sani',
    role: 'job_seeker',
    employerId: null,
    candidateId: 'cand-001',
  },
];

/** Where each role lands when it has no route of its own to go to. */
export const ROLE_HOME: Readonly<Record<Role, string>> = {
  staff: '/staff/dashboard',
  employer: '/hiring/talent-pool',
  job_seeker: '/me/fairs',
};

/**
 * sessionStorage, not localStorage: the demo identity should last as long as
 * the tab and no longer. A new visitor opening the deployed demo starts as
 * staff, which is the intended first impression.
 */
const USER_KEY = 'fo-demo-user';
const FAIR_KEY = 'fo-demo-active-fair';

/**
 * Storage throws in a private window, when site data is blocked, and in some
 * embedded webviews. None of that should stop the app rendering, so every
 * access is guarded and a failure simply means the value does not persist.
 */
function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Persisting is a convenience, not a requirement.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  // Rehydrated from the tab's session, so a refresh or a pasted deep link
  // stays with the identity the viewer picked. Without this the role guard
  // sends every reload of a /hiring route back to the staff dashboard.
  private readonly _user = signal<User>(restoreUser());

  /**
   * Fair that shortlists and interview slots are scoped to.
   *
   * `Shortlist` and `InterviewSlot` both carry a `fairId` but the talent-pool
   * filters do not, so the shell owns this choice and the features read it.
   * Seeded once the fairs load; `null` until then.
   */
  private readonly _activeFairId = signal<string | null>(read(FAIR_KEY));

  readonly user = this._user.asReadonly();
  readonly activeFairId = this._activeFairId.asReadonly();

  readonly role = computed<Role>(() => this._user().role);
  readonly isStaff = computed(() => this.role() === 'staff');
  readonly isEmployer = computed(() => this.role() === 'employer');
  readonly isJobSeeker = computed(() => this.role() === 'job_seeker');

  /** The employer this user acts for, or `null` for staff and job seekers. */
  readonly employerId = computed(() => this._user().employerId);

  /** The candidate record a job seeker owns, or `null` for everyone else. */
  readonly candidateId = computed(() => this._user().candidateId);

  /** Where the current role should be sent when it has no destination. */
  readonly homeRoute = computed(() => ROLE_HOME[this.role()]);

  readonly availableUsers = DEMO_USERS;

  /** Switches the demo identity. Ignores an id that is not in the demo cast. */
  switchUser(userId: string): void {
    const next = DEMO_USERS.find((candidate) => candidate.id === userId);
    if (!next) {
      return;
    }

    this._user.set(next);
    write(USER_KEY, next.id);

    // The previous user's fair is meaningless to a different employer.
    this._activeFairId.set(null);
    write(FAIR_KEY, null);
  }

  setActiveFair(fairId: string | null): void {
    this._activeFairId.set(fairId);
    write(FAIR_KEY, fairId);
  }
}

/** Falls back to the first demo user for a missing, stale or tampered id. */
function restoreUser(): User {
  const stored = read(USER_KEY);
  return DEMO_USERS.find((candidate) => candidate.id === stored) ?? DEMO_USERS[0];
}
