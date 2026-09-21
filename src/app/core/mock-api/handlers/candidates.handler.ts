import type { Candidate, User } from '../../models';
import type { MockDb } from '../mock-db';
import { type MockHandler, notFound, ok, paginate, readPageRequest } from '../mock-response';

type SortField = 'fullName' | 'university' | 'graduationYear' | 'cgpa';

const SORT_FIELDS: readonly SortField[] = ['fullName', 'university', 'graduationYear', 'cgpa'];

/**
 * Masks contact details unless this employer has shortlisted the candidate.
 *
 * Doing it here rather than in the UI is the point: an unmasked value never
 * reaches the browser, so the privacy rule holds even if a component forgets
 * to apply the pipe. Laravel will do exactly this in an API Resource.
 */
export function maskForViewer(candidate: Candidate, db: MockDb, viewer: User): Candidate {
  const employerId = viewer.employerId;
  const visible =
    // A job seeker is not a third party to their own record. Without this they
    // would open their profile and find their own email starred out.
    viewer.candidateId === candidate.id ||
    (employerId !== null &&
      db.shortlists.some(
        (shortlist) =>
          shortlist.employerId === employerId && shortlist.candidateId === candidate.id,
      ));

  if (visible) {
    return { ...candidate, isContactVisible: true };
  }

  const atIndex = candidate.email.indexOf('@');
  const maskedEmail =
    atIndex > 0 ? `${candidate.email[0]}***${candidate.email.slice(atIndex)}` : '***';

  return {
    ...candidate,
    email: maskedEmail,
    phone: null,
    isContactVisible: false,
  };
}

function compare(a: Candidate, b: Candidate, field: SortField): number {
  const left = a[field];
  const right = b[field];

  // Candidates without a CGPA sort last either way, rather than being treated
  // as a zero and polluting the top of an ascending sort.
  if (left === null) {
    return right === null ? 0 : 1;
  }
  if (right === null) {
    return -1;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

/**
 * `GET /candidates` — search, filters, sort and pagination, all server-side so
 * the semantics match what Laravel will do.
 */
export const listCandidates: MockHandler = ({ db, query, currentUser }) => {
  const search = query.get('search')?.toLowerCase().trim();
  const university = query.get('university');
  const field = query.get('field');
  const gradYear = query.get('grad_year');
  const minCgpa = query.get('min_cgpa');
  const fairId = query.get('fair_id');

  let results = db.candidates.filter((candidate) => {
    if (university && candidate.university !== university) {
      return false;
    }
    if (field && candidate.fieldOfStudy !== field) {
      return false;
    }
    if (gradYear && candidate.graduationYear !== Number(gradYear)) {
      return false;
    }
    if (minCgpa) {
      // A candidate with no CGPA cannot satisfy a minimum.
      if (candidate.cgpa === null || candidate.cgpa < Number(minCgpa)) {
        return false;
      }
    }
    if (fairId && !candidate.fairIds.includes(fairId)) {
      return false;
    }
    if (search) {
      const haystack =
        `${candidate.fullName} ${candidate.skills.join(' ')} ${candidate.fieldOfStudy}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });

  const sortParam = query.get('sort');
  const sort: SortField = SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : 'fullName';
  const direction = query.get('dir') === 'desc' ? -1 : 1;

  results = [...results].sort((a, b) => compare(a, b, sort) * direction);

  const masked = results.map((candidate) => maskForViewer(candidate, db, currentUser));
  return paginate(masked, readPageRequest(query));
};

export const getCandidate: MockHandler = ({ db, params, currentUser }) => {
  const candidate = db.candidates.find((entry) => entry.id === params['id']);
  return candidate ? ok(maskForViewer(candidate, db, currentUser)) : notFound('Candidate not found.');
};
