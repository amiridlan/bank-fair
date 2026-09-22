import type { AuditAction, AuditChange, AuditEntity, AuditEntry, User } from '../models';
import type { MockDb } from './mock-db';
import type { MockResult } from './mock-response';

/** A row of any table, seen generically so one differ can handle them all. */
export type AuditRecord = Readonly<Record<string, unknown>>;

/**
 * Fields whose VALUES are never written to the log (docs/09 L2).
 *
 * The log records that they changed, and nothing more. An audit log is a
 * second store of whatever it copies, so copying a person's old and new phone
 * number into it duplicates exactly the data the masking rules exist to
 * contain — and would leave that copy needing its own retention rule.
 *
 * `name` is absent on purpose: on an employer it is a company name, which is
 * not personal data. `contactName` is a person at that company, so it is here.
 */
const REDACTED_FIELDS: ReadonlySet<string> = new Set([
  'fullName',
  'email',
  'phone',
  'contactName',
  'contactEmail',
  'contactPhone',
]);

/** Bookkeeping, not decisions. Recording these would bury the real changes. */
const IGNORED_FIELDS: ReadonlySet<string> = new Set(['id', 'createdAt', 'updatedAt']);

/**
 * The log holds this many entries, newest kept.
 *
 * It lives in memory alongside the rest of the mock database, so it needs a
 * ceiling; a long demo session would otherwise grow it without limit.
 */
export const MAX_AUDIT_ENTRIES = 200;

/**
 * Tells the recorder how to find and name the record a route writes to.
 *
 * Attached to the route table rather than called from inside each handler. A
 * handler that forgets to log is an invisible hole; a route with no descriptor
 * is a visible one, and `auditedRoutes()` in the spec asserts every write has
 * one.
 */
export interface AuditDescriptor {
  readonly entity: AuditEntity;
  /** Looks up a row in whichever table this route writes to. */
  readonly find: (db: MockDb, id: string) => AuditRecord | null;
  /**
   * The id this request acted on. Route params for an update or a delete; for
   * a create it is only knowable from the response.
   */
  readonly idOf: (params: Readonly<Record<string, string>>, result: MockResult) => string | null;
  /** Human name for the row — an employer's name, a booth code. */
  readonly label: (record: AuditRecord, db: MockDb) => string;
  /**
   * Sharpens the action where "updated" would hide the point. Returning null
   * keeps the one derived from the method.
   */
  readonly action?: (before: AuditRecord | null, after: AuditRecord | null) => AuditAction | null;
}

/** The `data` payload of a handler's response, when it has one. */
export function resultData(result: MockResult): AuditRecord | null {
  const body = result.body;
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return null;
  }
  const data = (body as { data: unknown }).data;
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as AuditRecord)
    : null;
}

function display(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map(String).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Compares two versions of a row.
 *
 * Only ever called with both sides present. A create has nothing to compare
 * against and a delete has nothing left, and listing every field of a new
 * record as a change from nothing would bury the updates that matter.
 */
export function diffRecords(before: AuditRecord, after: AuditRecord): readonly AuditChange[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChange[] = [];

  for (const field of [...fields].sort()) {
    if (IGNORED_FIELDS.has(field)) {
      continue;
    }

    const from = display(before[field]);
    const to = display(after[field]);
    if (from === to) {
      continue;
    }

    changes.push(
      REDACTED_FIELDS.has(field)
        ? { field, from: null, to: null, redacted: true }
        : { field, from, to, redacted: false },
    );
  }

  return changes;
}

function actionForMethod(method: string): AuditAction {
  switch (method) {
    case 'POST':
      return 'created';
    case 'DELETE':
      return 'deleted';
    default:
      return 'updated';
  }
}

/** 2xx only. A refused write changed nothing, so there is nothing to record. */
function succeeded(result: MockResult): boolean {
  return result.status >= 200 && result.status < 300;
}

export interface RecordAuditInput {
  readonly db: MockDb;
  readonly descriptor: AuditDescriptor;
  readonly method: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly result: MockResult;
  readonly before: AuditRecord | null;
  readonly actor: User;
  readonly now: number;
}

/** Writes one entry, if the request actually changed something. */
export function recordAudit(input: RecordAuditInput): AuditEntry | null {
  const { db, descriptor, result, before, actor } = input;

  if (!succeeded(result)) {
    return null;
  }

  const id = descriptor.idOf(input.params, result);
  if (id === null) {
    return null;
  }

  const after = descriptor.find(db, id);
  const subject = after ?? before;
  if (!subject) {
    return null;
  }

  const entry: AuditEntry = {
    id: `audit-${db.auditEntries.length}-${input.now}`,
    at: new Date(input.now).toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: descriptor.action?.(before, after) ?? actionForMethod(input.method),
    entity: descriptor.entity,
    entityId: id,
    entityLabel: descriptor.label(subject, db),
    method: input.method,
    path: input.path,
    changes: before && after ? diffRecords(before, after) : [],
  };

  db.auditEntries.push(entry);
  if (db.auditEntries.length > MAX_AUDIT_ENTRIES) {
    db.auditEntries.splice(0, db.auditEntries.length - MAX_AUDIT_ENTRIES);
  }

  return entry;
}
