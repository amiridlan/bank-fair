import type { BoothPackage, CompanySize, Employer, EmployerStage } from '../../models';
import { klTimestamp } from '../seed/kl-time';
import { PACKAGE_PRICE_MYR } from '../seed/seed-employers';
import {
  type MockHandler,
  conflict,
  created,
  notFound,
  ok,
  okList,
  validationError,
} from '../mock-response';

const VALID_SIZES: readonly CompanySize[] = ['1-50', '51-200', '201-1000', '1000+'];
const VALID_PACKAGES: readonly BoothPackage[] = ['standard', 'premium', 'platinum'];
const VALID_STAGES: readonly EmployerStage[] = [
  'lead',
  'proposal',
  'confirmed',
  'paid',
  'lost',
];

// Deliberately permissive: just enough to reject an obvious typo, the way a
// server-side rule would. Real validation belongs in Laravel.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Mirrors Laravel's validation, including the message wording, so the form's
 * 422 handling is exercised against the shape it will really see.
 */
function validate(
  payload: Record<string, unknown>,
  partial: boolean,
): Record<string, readonly string[]> {
  const errors: Record<string, readonly string[]> = {};

  const check = (field: string, label: string): void => {
    if (partial && !(field in payload)) {
      return;
    }
    if (requiredString(payload[field]) === null) {
      errors[field] = [`The ${label} field is required.`];
    }
  };

  check('name', 'company name');
  check('industry', 'industry');
  check('contactName', 'contact name');

  if (!partial || 'contactEmail' in payload) {
    const email = requiredString(payload['contactEmail']);
    if (email === null) {
      errors['contactEmail'] = ['The contact email field is required.'];
    } else if (!EMAIL_PATTERN.test(email)) {
      errors['contactEmail'] = ['The contact email must be a valid email address.'];
    }
  }

  if (!partial || 'companySize' in payload) {
    const size = payload['companySize'];
    if (typeof size !== 'string' || !VALID_SIZES.includes(size as CompanySize)) {
      errors['companySize'] = ['The selected company size is invalid.'];
    }
  }

  const boothPackage = payload['boothPackage'];
  if (
    boothPackage !== undefined &&
    boothPackage !== null &&
    (typeof boothPackage !== 'string' || !VALID_PACKAGES.includes(boothPackage as BoothPackage))
  ) {
    errors['boothPackage'] = ['The selected booth package is invalid.'];
  }

  return errors;
}

/** `GET /employers` — `stage`, `fair_id` and `search` filters. */
export const listEmployers: MockHandler = ({ db, query }) => {
  const stage = query.get('stage');
  const fairId = query.get('fair_id');
  const search = query.get('search')?.toLowerCase().trim();

  const employers = db.employers.filter((employer) => {
    if (stage && employer.stage !== stage) {
      return false;
    }
    if (fairId && !employer.fairIds.includes(fairId)) {
      return false;
    }
    if (search) {
      const haystack = `${employer.name} ${employer.industry} ${employer.contactName}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });

  return okList(employers);
};

export const getEmployer: MockHandler = ({ db, params }) => {
  const employer = db.employers.find((candidate) => candidate.id === params['id']);
  return employer ? ok(employer) : notFound('Employer not found.');
};

/** `POST /employers` — a new employer always starts as a Lead. */
export const createEmployer: MockHandler = ({ db, body, now }) => {
  const payload = isRecord(body) ? body : {};
  const errors = validate(payload, false);
  if (Object.keys(errors).length > 0) {
    return validationError(errors);
  }

  const name = requiredString(payload['name']) ?? '';
  if (db.employers.some((employer) => employer.name.toLowerCase() === name.toLowerCase())) {
    return conflict('An employer with that name already exists.');
  }

  const nextNumber = db.employers.length + 1;
  const boothPackage = (payload['boothPackage'] as BoothPackage | null) ?? null;

  const employer: Employer = {
    id: `emp-${String(nextNumber).padStart(3, '0')}`,
    name,
    industry: requiredString(payload['industry']) ?? '',
    companySize: payload['companySize'] as CompanySize,
    stage: 'lead',
    lostReason: null,
    contactName: requiredString(payload['contactName']) ?? '',
    contactEmail: requiredString(payload['contactEmail']) ?? '',
    contactPhone: requiredString(payload['contactPhone']),
    boothPackage,
    // A lead has no deal value yet; it appears when the stage reaches proposal.
    dealValueMyr: null,
    fairIds: [],
    notes: requiredString(payload['notes']),
    createdAt: klTimestamp(0, 9, 0, now),
    updatedAt: klTimestamp(0, 9, 0, now),
  };

  db.employers = [employer, ...db.employers];
  return created(employer);
};

/**
 * `PATCH /employers/{id}` — either field edits or a stage move.
 *
 * Two business rules the UI depends on: moving to `lost` requires a reason,
 * and moving to `paid` requires a booth package, because the deal value is
 * derived from it.
 */
export const updateEmployer: MockHandler = ({ db, params, body, now }) => {
  const index = db.employers.findIndex((employer) => employer.id === params['id']);
  if (index < 0) {
    return notFound('Employer not found.');
  }

  const current = db.employers[index];
  const payload = isRecord(body) ? body : {};

  const errors = validate(payload, true);
  if (Object.keys(errors).length > 0) {
    return validationError(errors);
  }

  let stage = current.stage;
  if ('stage' in payload) {
    const nextStage = payload['stage'];
    if (typeof nextStage !== 'string' || !VALID_STAGES.includes(nextStage as EmployerStage)) {
      return validationError({ stage: ['The selected stage is invalid.'] });
    }
    stage = nextStage as EmployerStage;
  }

  const lostReason =
    'lostReason' in payload ? requiredString(payload['lostReason']) : current.lostReason;

  if (stage === 'lost' && lostReason === null) {
    return validationError({ lostReason: ['The lost reason field is required.'] });
  }

  const boothPackage =
    'boothPackage' in payload
      ? ((payload['boothPackage'] as BoothPackage | null) ?? null)
      : current.boothPackage;

  if (stage === 'paid' && boothPackage === null) {
    return validationError({
      boothPackage: ['A booth package is required before an employer can be marked paid.'],
    });
  }

  const earnsValue = stage === 'proposal' || stage === 'confirmed' || stage === 'paid';

  const updated: Employer = {
    ...current,
    name: requiredString(payload['name']) ?? current.name,
    industry: requiredString(payload['industry']) ?? current.industry,
    companySize: (payload['companySize'] as CompanySize | undefined) ?? current.companySize,
    stage,
    lostReason: stage === 'lost' ? lostReason : null,
    contactName: requiredString(payload['contactName']) ?? current.contactName,
    contactEmail: requiredString(payload['contactEmail']) ?? current.contactEmail,
    contactPhone:
      'contactPhone' in payload ? requiredString(payload['contactPhone']) : current.contactPhone,
    boothPackage,
    dealValueMyr: boothPackage !== null && earnsValue ? PACKAGE_PRICE_MYR[boothPackage] : null,
    notes: 'notes' in payload ? requiredString(payload['notes']) : current.notes,
    updatedAt: klTimestamp(0, 12, 0, now),
  };

  db.employers[index] = updated;
  return ok(updated);
};
