/**
 * An employer's application to attend a fair.
 *
 * Unlike a job seeker's registration, which is instant, this is reviewed:
 * an employer at a fair is a booth that gets paid for and a sales
 * conversation, so staff decide (docs/08 S-D3).
 */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface FairApplication {
  readonly id: string;
  readonly fairId: string;
  readonly employerId: string;
  readonly employerName: string;
  readonly status: ApplicationStatus;
  readonly appliedAt: string;
  /** Null while pending. */
  readonly decidedAt: string | null;
  /**
   * Required when rejected, so the employer is told why rather than left to
   * guess. Null otherwise.
   */
  readonly rejectionReason: string | null;
}
