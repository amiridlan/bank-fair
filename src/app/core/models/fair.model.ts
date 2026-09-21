export type FairStatus = 'draft' | 'open' | 'live' | 'completed';

export interface Fair {
  readonly id: string;
  readonly name: string;
  readonly venue: string;
  readonly city: string;
  /** ISO 8601 with the +08:00 offset, e.g. `2026-09-21T09:00:00+08:00`. */
  readonly startDate: string;
  readonly endDate: string;
  readonly status: FairStatus;
  readonly boothTotal: number;
  readonly boothAssigned: number;
  readonly registrations: number;
  readonly checkIns: number;
}
