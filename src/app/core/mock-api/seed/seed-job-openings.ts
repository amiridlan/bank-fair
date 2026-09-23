import type {
  Employer,
  EmploymentType,
  ExperienceLevel,
  JobOpening,
} from '../../models';
import { klTimestamp } from './kl-time';
import { SeededRandom } from './random';
import {
  FIELDS_BY_FUNCTION,
  JOB_LOCATIONS,
  SKILLS_BY_FIELD,
  TITLES_BY_FUNCTION,
} from './words';

/**
 * The seed this file draws from — deliberately its own, not the one threaded
 * through `buildMockDb`.
 *
 * Sharing that stream would mean every number drawn here shifts every number
 * drawn after it. That is not hypothetical: adding two fairs to the seed once
 * moved the shared sequence enough to drop fair-03's booth fill from 40% to
 * 1/40, and it took a browser session to find. A separate stream makes this
 * file's output depend on this file alone.
 */
const JOB_SEED = 20260922;

/** Most fairs are graduate-facing, so the mix leans junior. */
const LEVEL_PLAN: readonly (readonly [ExperienceLevel, number])[] = [
  ['fresh_graduate', 40],
  ['junior', 30],
  ['mid', 22],
  ['senior', 8],
];

const TYPE_PLAN: readonly (readonly [EmploymentType, number])[] = [
  ['full_time', 70],
  ['internship', 22],
  ['contract', 8],
];

/**
 * Monthly gross bands in MYR by experience level, which is what a Malaysian
 * posting quotes when it quotes anything.
 */
const SALARY_BAND: Readonly<Record<ExperienceLevel, readonly [number, number]>> = {
  fresh_graduate: [2800, 4200],
  junior: [3800, 6000],
  mid: [6000, 10000],
  senior: [10000, 18000],
};

/** Internships are paid an allowance, not a salary. */
const INTERN_BAND: readonly [number, number] = [800, 1800];

/**
 * Roughly three in five openings state a range.
 *
 * Not a rounder number because the point of the null case is that it turns up
 * often enough to be designed for rather than treated as an edge (docs/11
 * J-D5).
 */
const DISCLOSES_SALARY = 0.6;

const FUNCTIONS: readonly string[] = Object.keys(TITLES_BY_FUNCTION);

/** Rounds to the nearest 100, the way a real posting would be written. */
function round100(value: number): number {
  return Math.round(value / 100) * 100;
}

/**
 * Job openings for the employers who actually hold a booth somewhere.
 *
 * Only committed employers are given openings: an employer who is still a lead
 * is not attending, so advertising their roles at a fair would promise a booth
 * that does not exist (docs/11 J-D3). The openings are attached to every fair
 * that employer attends, because a company hiring for a role is hiring for it
 * at all of them.
 */
export function seedJobOpenings(
  employers: readonly Employer[],
  now: number,
): JobOpening[] {
  const random = new SeededRandom(JOB_SEED);
  const openings: JobOpening[] = [];

  const hiring = employers.filter(
    (employer) => employer.stage === 'confirmed' || employer.stage === 'paid',
  );

  for (const employer of hiring) {
    if (employer.fairIds.length === 0) {
      continue;
    }

    // A booth is one company's whole graduate intake, not a jobs board.
    const count = random.int(3, 7);

    // Two functions per employer rather than one: a semiconductor company
    // hires engineers and finance people, and a list where every role at a
    // booth is the same family is not worth filtering.
    const employerFunctions = random.sample(FUNCTIONS, random.int(1, 2));
    const usedTitles = new Set<string>();

    for (let i = 0; i < count; i++) {
      const jobFunction = random.pick(employerFunctions);
      const title = random.pick(TITLES_BY_FUNCTION[jobFunction]);

      // One employer advertising the same title twice reads as a data bug.
      if (usedTitles.has(title)) {
        continue;
      }
      usedTitles.add(title);

      const employmentType = random.weighted(TYPE_PLAN);
      // An internship is a fresh-graduate role whatever the roll said.
      const experienceLevel: ExperienceLevel =
        employmentType === 'internship' ? 'fresh_graduate' : random.weighted(LEVEL_PLAN);

      const field = random.pick(FIELDS_BY_FUNCTION[jobFunction]);
      const skills = random.sample(SKILLS_BY_FIELD[field], random.int(3, 5));

      const [bandMin, bandMax] =
        employmentType === 'internship' ? INTERN_BAND : SALARY_BAND[experienceLevel];
      const discloses = random.bool(DISCLOSES_SALARY);
      const salaryMinMyr = discloses ? round100(random.int(bandMin, bandMax)) : null;
      const salaryMaxMyr =
        salaryMinMyr === null
          ? null
          : round100(salaryMinMyr + random.int(400, Math.max(600, bandMax - bandMin)));

      openings.push({
        id: `job-${String(openings.length + 1).padStart(3, '0')}`,
        employerId: employer.id,
        fairIds: [...employer.fairIds],
        title,
        jobFunction,
        employmentType,
        experienceLevel,
        location: random.pick(JOB_LOCATIONS),
        skills,
        salaryMinMyr,
        salaryMaxMyr,
        headcount: random.weighted([
          [1, 40],
          [2, 30],
          [3, 15],
          [5, 10],
          [10, 5],
        ]),
        postedAt: klTimestamp(-random.int(3, 45), 10, 0, now),
      });
    }
  }

  return openings;
}
