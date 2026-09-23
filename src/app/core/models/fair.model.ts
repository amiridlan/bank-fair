export type FairStatus = 'draft' | 'open' | 'live' | 'completed';

export interface Fair {
  readonly id: string;
  readonly name: string;
  readonly venue: string;
  readonly city: string;
  /**
   * One paragraph a job seeker reads before deciding to register (docs/11
   * J-D7). Required rather than nullable: a fair with nothing said about it is
   * a fair nobody can judge, so the seed has to supply one.
   */
  readonly description: string;
  /** ISO 8601 with the +08:00 offset, e.g. `2026-09-21T09:00:00+08:00`. */
  readonly startDate: string;
  readonly endDate: string;
  readonly status: FairStatus;
  readonly boothTotal: number;
  readonly boothAssigned: number;
  readonly registrations: number;
  readonly checkIns: number;
}
