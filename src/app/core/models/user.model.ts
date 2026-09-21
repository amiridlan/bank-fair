/**
 * Roles the portal serves.
 *
 * `employer` was called `hiring_manager` until S1. It is the same person —
 * someone acting for an employer — renamed once self-service arrived, so the
 * role that registers and the role that browses candidates are not two names
 * for one concept (docs/08 S-D1).
 */
export type Role = 'staff' | 'employer' | 'job_seeker';

export interface User {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  /** The employer this user acts for. `null` for staff and job seekers. */
  readonly employerId: string | null;
  /**
   * The candidate record this job seeker owns — the same record employers
   * browse in the talent pool, rather than a second copy of it. `null` for
   * staff and employers.
   */
  readonly candidateId: string | null;
}
