import type { AuditEntry } from '../../models';
import { type MockHandler, notFound, paginate, readPageRequest } from '../mock-response';

/**
 * `GET /audit-entries` — staff only (docs/09 L1).
 *
 * Every role's writes are recorded; only staff can read them back. Anyone
 * else gets 404 rather than 403, the same answer the rest of this API gives,
 * so the response does not confirm the log exists.
 *
 * Newest first: a queue of what just happened is what anyone opens this for.
 */
export const listAuditEntries: MockHandler = ({ db, query, currentUser }) => {
  if (currentUser.role !== 'staff') {
    return notFound('Not found.');
  }

  const actorId = query.get('actor_id');
  const entity = query.get('entity');
  const action = query.get('action');

  const rows = db.auditEntries.filter((entry: AuditEntry) => {
    if (actorId && entry.actorId !== actorId) {
      return false;
    }
    if (entity && entry.entity !== entity) {
      return false;
    }
    if (action && entry.action !== action) {
      return false;
    }
    return true;
  });

  return paginate([...rows].reverse(), readPageRequest(query, 25));
};
