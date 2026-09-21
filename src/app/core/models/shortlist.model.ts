import type { Candidate } from './candidate.model';

export interface Shortlist {
  readonly id: string;
  readonly employerId: string;
  readonly candidateId: string;
  /** Shortlists are per fair — see the active-fair picker in docs/04. */
  readonly fairId: string;
  readonly note: string | null;
  readonly createdAt: string;
  /** Embedded so the shortlist view renders without N extra requests. */
  readonly candidate: Candidate;
}
