import type { Candidate, Qualification, User } from '../../models';
import type { MockDb } from '../mock-db';
import {
  type MockHandler,
  notFound,
  ok,
  paginate,
  readPageRequest,
  validationError,
} from '../mock-response';

type SortField = 'fullName' | 'university' | 'graduationYear' | 'cgpa';

const SORT_FIELDS: readonly SortField[] = ['fullName', 'university', 'graduationYear', 'cgpa'];

/**
 * Whether this viewer may see this candidate at all (docs/11 V1, V-D1).
 *
 * Distinct from masking, and prior to it: masking decides which *fields* of a
 * visible candidate are readable, this decides whether the candidate is
 * visible in the first place. Both are enforced here rather than in the UI.
 *
 * The rule follows the consent. A job seeker registers for a named fair, and
 * what they agree to is that employers *at that fair* may see their profile.
 * An employer attending no fair the candidate registered for was never
 * consented to, so showing them that candidate makes the consent record
 * decorative — which is the substantive failure under the PDPA, not a
 * cosmetic one.
 *
 * "Attending" here means tagged to the fair **and** commercially committed —
 * `confirmed` or `paid`. Deliberately not the booth-holding rule ADR-011 uses
 * for the exhibitor list a job seeker reads: that question is "where is their
 * stand", and a stand is what a visitor walks to. This question is "have they
 * been accepted for this fair", and an employer approved but not yet seated
 * has been. In the seed that difference is 16 employer-fair pairs, so it is
 * not academic.
 *
 * Staff see every registrant, masked. They run the fairs; a staff member who
 * cannot see who registered cannot run one.
 */
export function canViewCandidate(candidate: Candidate, db: MockDb, viewer: User): boolean {
  // Your own record, always. A viewer is not a third party to themselves.
  if (viewer.candidateId === candidate.id) {
    return true;
  }

  switch (viewer.role) {
    case 'staff':
      return true;

    case 'job_seeker':
      // A job seeker has no business browsing other job seekers.
      return false;

    case 'employer': {
      const employer = db.employers.find((entry) => entry.id === viewer.employerId);
      if (!employer) {
        return false;
      }
      // A lead who was never accepted is not attending anything.
      if (employer.stage !== 'confirmed' && employer.stage !== 'paid') {
        return false;
      }
      return candidate.fairIds.some((fairId) => employer.fairIds.includes(fairId));
    }

    default:
      return false;
  }
}

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
    // Visibility first, and separately from the query filters: a filter is
    // something the caller asked for, this is something they are not allowed
    // to override by leaving a parameter off.
    if (!canViewCandidate(candidate, db, currentUser)) {
      return false;
    }
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

  // 404 for both "no such candidate" and "not yours to see", so the response
  // does not confirm a record exists to someone who may not read it — the
  // same answer the rest of this API gives a refusal.
  if (!candidate || !canViewCandidate(candidate, db, currentUser)) {
    return notFound('Candidate not found.');
  }

  return ok(maskForViewer(candidate, db, currentUser));
};

const QUALIFICATIONS: readonly Qualification[] = ['diploma', 'degree', 'masters', 'phd'];

/** Trimmed, or null when the value is absent or blank. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `PATCH /candidates/{id}` — a job seeker edits their own profile (docs/08 S4).
 *
 * Only their own: anyone else gets 404, the same answer a missing id gets, so
 * the response does not confirm which candidates exist. Staff are not given an
 * edit path here either — the record belongs to the person, which is the whole
 * point of the role.
 *
 * `fairIds` and `isContactVisible` are not writable. Registration is what puts
 * someone at a fair (with recorded consent), and masking is the API's
 * decision; letting either be PATCHed would route around both.
 */
export const updateCandidate: MockHandler = ({ db, params, body, currentUser }) => {
  const index = db.candidates.findIndex((entry) => entry.id === params['id']);
  if (index === -1 || currentUser.candidateId !== params['id']) {
    return notFound('Candidate not found.');
  }

  const payload = isRecord(body) ? body : {};
  const errors: Record<string, string[]> = {};

  const fullName = text(payload['fullName']);
  if (fullName === null) {
    errors['fullName'] = ['The name field is required.'];
  }

  const headline = text(payload['headline']);
  if (headline === null) {
    errors['headline'] = ['The headline field is required.'];
  } else if (headline.length > 120) {
    errors['headline'] = ['The headline may not be longer than 120 characters.'];
  }

  const university = text(payload['university']);
  if (university === null) {
    errors['university'] = ['The university field is required.'];
  }

  const fieldOfStudy = text(payload['fieldOfStudy']);
  if (fieldOfStudy === null) {
    errors['fieldOfStudy'] = ['The field of study is required.'];
  }

  const qualification = payload['qualification'];
  if (!QUALIFICATIONS.includes(qualification as Qualification)) {
    errors['qualification'] = ['The selected qualification is invalid.'];
  }

  const thisYear = new Date().getFullYear();
  const graduationYear = payload['graduationYear'];
  if (
    typeof graduationYear !== 'number' ||
    !Number.isInteger(graduationYear) ||
    graduationYear < thisYear - 60 ||
    graduationYear > thisYear + 10
  ) {
    errors['graduationYear'] = ['The graduation year is not a plausible year.'];
  }

  // Optional, but a number that is present must be a real CGPA.
  const cgpaRaw = payload['cgpa'];
  const cgpa = cgpaRaw === null || cgpaRaw === undefined ? null : Number(cgpaRaw);
  if (cgpa !== null && (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 4)) {
    errors['cgpa'] = ['The CGPA must be between 0.00 and 4.00.'];
  }

  const email = text(payload['email']);
  if (email === null) {
    errors['email'] = ['The email field is required.'];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors['email'] = ['The email must be a valid email address.'];
  }

  const skillsRaw = payload['skills'];
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map(text).filter((skill): skill is string => skill !== null)
    : null;
  if (skills === null) {
    errors['skills'] = ['The skills field must be a list.'];
  } else if (skills.length > 20) {
    errors['skills'] = ['You can list up to 20 skills.'];
  }

  if (Object.keys(errors).length > 0) {
    return validationError(errors);
  }

  // Every branch above already guarantees these, but the compiler cannot see
  // it through the errors object. Restating it narrows the types honestly
  // rather than asserting them with a cast, and it is the assertion that
  // would rot if a rule above were ever relaxed.
  if (
    fullName === null ||
    headline === null ||
    university === null ||
    fieldOfStudy === null ||
    email === null ||
    skills === null ||
    typeof graduationYear !== 'number' ||
    !QUALIFICATIONS.includes(qualification as Qualification)
  ) {
    return validationError(errors);
  }

  const updated: Candidate = {
    ...db.candidates[index],
    fullName,
    headline,
    university,
    fieldOfStudy,
    qualification: qualification as Qualification,
    graduationYear,
    cgpa: cgpa === null ? null : Math.round(cgpa * 100) / 100,
    email,
    phone: text(payload['phone']),
    skills,
  };
  db.candidates[index] = updated;

  // Through the mask, so the response is shaped like every other read.
  return ok(maskForViewer(updated, db, currentUser));
};
