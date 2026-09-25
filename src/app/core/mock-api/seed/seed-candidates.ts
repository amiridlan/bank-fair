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
/**
 * The demo job seeker's name, shared with `DEMO_USERS` so the two cannot drift.
 * Declared here rather than imported from the auth store, because the mock
 * database already imports that store and the reverse would be a cycle.
 */
export const SEEKER_NAME = 'Ahmad Zaki Abdullah Sani';

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

  // cand-001 is the record the demo job seeker owns, so its name must match
  // the name `DEMO_USERS` shows in the top bar. Forced rather than trusted:
  // the generated name comes from the shared random stream, so it moved when
  // two fairs were added to the seed, and the hard-coded user name silently
  // stopped matching. Someone signed in as the job seeker saw one name in the
  // chrome and a different one on their own profile.
  //
  // Same pattern as seed-employers.ts pinning emp-001 and emp-002: overwrite
  // after generation, which changes no draw and so shifts nothing downstream.
  const [given, ...rest] = SEEKER_NAME.toLowerCase().split(' ');
  candidates[0] = {
    ...candidates[0],
    fullName: SEEKER_NAME,
    email: `${given}.${rest[rest.length - 1]}@example.com`,
  };

  // The generator can independently produce the same name — across 300 draws
  // from these lists it does. Duplicate names elsewhere are realistic and are
  // left alone, but a second person called exactly what the demo job seeker is
  // called makes the demo unreadable: a search for them returns two rows and
  // it is not obvious which is "you".
  //
  // Renamed by index rather than by a random draw, so no number is consumed
  // and nothing downstream shifts.
  for (let index = 1; index < candidates.length; index++) {
    if (candidates[index].fullName === SEEKER_NAME) {
      const family = FAMILY_NAMES[(index + 1) % FAMILY_NAMES.length];
      candidates[index] = {
        ...candidates[index],
        fullName: `${candidates[index].fullName.split(' ')[0]} ${family}`,
      };
    }
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
