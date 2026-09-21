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
  { id: 'u-staff-1', name: 'Farah Iskandar', role: 'staff', employerId: null },
  { id: 'u-hm-1', name: 'Daniel Lim', role: 'hiring_manager', employerId: 'emp-001' },
  { id: 'u-hm-2', name: 'Priya Nair', role: 'hiring_manager', employerId: 'emp-002' },
];

/** Where each role lands when it has no route of its own to go to. */
export const ROLE_HOME: Readonly<Record<Role, string>> = {
  staff: '/staff/dashboard',
  hiring_manager: '/hiring/talent-pool',
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<User>(DEMO_USERS[0]);

  /**
   * Fair that shortlists and interview slots are scoped to.
   *
   * `Shortlist` and `InterviewSlot` both carry a `fairId` but the talent-pool
   * filters do not, so the shell owns this choice and the features read it.
   * Seeded once the fairs load; `null` until then.
   */
  private readonly _activeFairId = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly activeFairId = this._activeFairId.asReadonly();

  readonly role = computed<Role>(() => this._user().role);
  readonly isStaff = computed(() => this.role() === 'staff');
  readonly isHiringManager = computed(() => this.role() === 'hiring_manager');

  /** The employer this user acts for, or `null` for staff. */
  readonly employerId = computed(() => this._user().employerId);

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
    // The previous user's fair is meaningless to a different employer.
    this._activeFairId.set(null);
  }

  setActiveFair(fairId: string | null): void {
    this._activeFairId.set(fairId);
  }
}
