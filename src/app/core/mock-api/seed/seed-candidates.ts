import type { Candidate, Qualification } from '../../models';
import { klYear } from './kl-time';
import { SeededRandom } from './random';
import {
  FAMILY_NAMES,
  FIELDS_OF_STUDY,
  GIVEN_NAMES,
  HEADLINE_INTERESTS,
  SKILLS_BY_FIELD,
  UNIVERSITIES,
} from './words';

const QUALIFICATION_WEIGHTS: readonly (readonly [Qualification, number])[] = [
  ['degree', 70],
  ['diploma', 15],
  ['masters', 13],
  ['phd', 2],
];

const QUALIFICATION_LABEL: Readonly<Record<Qualification, string>> = {
  diploma: 'Diploma',
  degree: 'Final-year',
  masters: "Master's",
  phd: 'PhD',
};

function emailLocalPart(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .join('.');
}

/** 300 candidates — enough for pagination and filters to mean something. */
export function seedCandidates(random: SeededRandom, now: number): Candidate[] {
  const currentYear = klYear(now);
  const candidates: Candidate[] = [];
  const usedEmails = new Set<string>();

  for (let index = 0; index < 300; index++) {
    const fullName = `${random.pick(GIVEN_NAMES)} ${random.pick(FAMILY_NAMES)}`;
    const fieldOfStudy = random.pick(FIELDS_OF_STUDY);
    const qualification = random.weighted(QUALIFICATION_WEIGHTS);
    const skillPool = SKILLS_BY_FIELD[fieldOfStudy] ?? [];

    // Duplicate names are realistic, but emails must stay unique.
    const base = emailLocalPart(fullName);
    let local = base;
    let suffix = 2;
    while (usedEmails.has(local)) {
      local = `${base}${suffix}`;
      suffix++;
    }
    usedEmails.add(local);

    candidates.push({
      id: `cand-${String(index + 1).padStart(3, '0')}`,
      fullName,
      university: random.pick(UNIVERSITIES),
      fieldOfStudy,
      qualification,
      graduationYear: random.int(currentYear - 2, currentYear + 1),
      cgpa: random.bool(0.05)
        ? null
        : random.decimal(...pickCgpaRange(random), 2),
      skills: random.sample(skillPool, random.int(3, Math.min(7, skillPool.length))),
      headline: `${QUALIFICATION_LABEL[qualification]} ${fieldOfStudy} student, interested in ${random.pick(HEADLINE_INTERESTS)}`,
      email: `${local}@example.com`,
      phone: `+60 1${random.int(0, 9)}-000 ${String(random.int(0, 9999)).padStart(4, '0')}`,
      // The API decides visibility per request; this is the unmasked record.
      isContactVisible: true,
      fairIds: random.sample(['fair-01', 'fair-02', 'fair-03'], random.int(1, 3)),
    });
  }

  return candidates;
}

/**
 * CGPA bands weighted toward 3.0–3.6 rather than flat across 2.50–4.00, which
 * is closer to what a real cohort looks like.
 */
function pickCgpaRange(random: SeededRandom): [number, number] {
  return random.weighted<[number, number]>([
    [[2.5, 3.0], 15],
    [[3.0, 3.6], 60],
    [[3.6, 4.0], 25],
  ]);
}
