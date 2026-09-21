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
