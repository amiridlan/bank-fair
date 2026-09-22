import type { Role } from './user.model';

/** The kinds of record the log can describe. */
export type AuditEntity =
  | 'employer'
  | 'candidate'
  | 'booth'
  | 'shortlist'
  | 'fair-application'
  | 'fair-registration'
  | 'interview-slot'
  | 'demo';

/**
 * What was done. Derived from the HTTP method, then refined where a plain
 * "updated" would hide the thing worth knowing — an application that was
 * approved, a booth that was cleared.
 */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'cleared'
  | 'booked'
  | 'cancelled'
  | 'reset';

/**
 * One field that changed.
 *
 * When `redacted` is true, `from` and `to` are null and were never stored.
 * That is not a display choice the view could undo — the values do not exist
 * in the log (docs/09 L2).
 */
export interface AuditChange {
  readonly field: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly redacted: boolean;
}

/**
 * One recorded write.
 *
 * The actor is copied in rather than referenced: a log that says "user u-emp-1"
 * is useless once that user is gone, and an audit trail that can be changed by
 * editing another record is not an audit trail.
 */
export interface AuditEntry {
  readonly id: string;
  /** ISO 8601 with the +08:00 offset, like every other timestamp here. */
  readonly at: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorRole: Role;
  readonly action: AuditAction;
  readonly entity: AuditEntity;
  readonly entityId: string;
  /** Human name for the record, e.g. the employer's name or a booth code. */
  readonly entityLabel: string;
  readonly method: string;
  readonly path: string;
  readonly changes: readonly AuditChange[];
}
