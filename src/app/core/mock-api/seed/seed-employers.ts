import type { BoothPackage, CompanySize, Employer, EmployerStage } from '../../models';
import { klTimestamp } from './kl-time';
import { SeededRandom } from './random';
import {
  COMPANY_PREFIXES,
  COMPANY_SUFFIXES,
  FAMILY_NAMES,
  GIVEN_NAMES,
  INDUSTRIES,
  INDUSTRY_NOUNS,
} from './words';

/** Booth package prices in RM (docs/05). */
export const PACKAGE_PRICE_MYR: Readonly<Record<BoothPackage, number>> = {
  platinum: 12_000,
  premium: 7_500,
  standard: 3_500,
};

/** Stage distribution across the 60 employers (docs/05). */
const STAGE_PLAN: readonly (readonly [EmployerStage, number])[] = [
  ['lead', 15],
  ['proposal', 12],
  ['confirmed', 10],
  ['paid', 20],
  ['lost', 3],
];

const COMPANY_SIZES: readonly CompanySize[] = ['1-50', '51-200', '201-1000', '1000+'];

const LOST_REASONS: readonly string[] = [
  'Budget not approved this cycle.',
  'Went with a competitor event.',
  'No graduate hiring this year.',
];

const STAGES_WITH_VALUE: ReadonlySet<EmployerStage> = new Set<EmployerStage>([
  'proposal',
  'confirmed',
  'paid',
]);

/**
 * Per-fair attendance likelihood. fair-04 is a draft with nothing sold yet, so
 * it never appears; fair-05 is the completed one, which sold out.
 */
const FAIR_ATTENDANCE: readonly (readonly [string, number])[] = [
  ['fair-01', 1], // live, busiest
  ['fair-02', 0.7],
  ['fair-03', 0.4], // regional, thinnest
  ['fair-05', 1], // completed, sold out
];

function pickFairs(random: SeededRandom, scale: number): string[] {
  const fairs = FAIR_ATTENDANCE.filter(([, chance]) => random.bool(chance * scale)).map(
    ([fairId]) => fairId,
  );
  // Everyone past the lead stage is tied to at least one fair.
  return fairs.length > 0 ? fairs : ['fair-01'];
}

function contactEmail(companyName: string, contactName: string): string {
  const local = contactName
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  // Fictional address on example.com — never a real corporate domain.
  const domain = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)[0];
  return `${local}@${domain}.example.com`;
}

/**
 * 60 employers spread across the pipeline.
 *
 * `emp-001` and `emp-002` are fixed: they are the employers the two demo
 * hiring managers work for, so the demo always has one Paid employer with a
 * booth and one Confirmed employer without.
 */
export function seedEmployers(random: SeededRandom, now: number): Employer[] {
  const stages: EmployerStage[] = [];
  for (const [stage, count] of STAGE_PLAN) {
    for (let i = 0; i < count; i++) {
      stages.push(stage);
    }
  }
  // Shuffle so the board is not sorted by stage, then pin the two demo slots.
  const shuffled = random.shuffle(stages);
  shuffled[0] = 'paid';
  shuffled[1] = 'confirmed';

  const usedNames = new Set<string>();
  const employers: Employer[] = [];

  for (let index = 0; index < shuffled.length; index++) {
    const stage = shuffled[index];
    const industry = random.pick(INDUSTRIES);

    // Prefix + industry noun + suffix. Retry on the rare collision.
    let name: string;
    do {
      const prefix = random.pick(COMPANY_PREFIXES);
      const noun = random.pick(INDUSTRY_NOUNS[industry] ?? ['Holdings']);
      const suffix = random.pick(COMPANY_SUFFIXES);
      name = `${prefix} ${noun} ${suffix}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const contactName = `${random.pick(GIVEN_NAMES)} ${random.pick(FAMILY_NAMES)}`;

    // Only committed employers have a package; a lead has not chosen one yet.
    const boothPackage: BoothPackage | null =
      stage === 'lead'
        ? null
        : random.weighted<BoothPackage>([
            ['standard', 60],
            ['premium', 30],
            ['platinum', 10],
          ]);

    const dealValueMyr =
      boothPackage !== null && STAGES_WITH_VALUE.has(stage) ? PACKAGE_PRICE_MYR[boothPackage] : null;

    // Which fairs this employer is involved with. Lost and lead employers are
    // not attached to one. Committed employers spread across the non-draft
    // fairs, weighted so the live fair is busiest — there are only 30
    // committed employers and 160 non-draft booths, so a thin spread would
    // leave every floor plan nearly empty.
    const fairIds =
      stage === 'lost' || stage === 'lead'
        ? []
        : pickFairs(random, stage === 'proposal' ? 0.45 : 1);

    const createdDaysAgo = random.int(20, 180);

    employers.push({
      id: `emp-${String(index + 1).padStart(3, '0')}`,
      name,
      industry,
      companySize: random.pick(COMPANY_SIZES),
      stage,
      lostReason: stage === 'lost' ? random.pick(LOST_REASONS) : null,
      contactName,
      contactEmail: contactEmail(name, contactName),
      contactPhone: random.bool(0.85)
        ? `+60 1${random.int(0, 9)}-000 ${String(random.int(0, 9999)).padStart(4, '0')}`
        : null,
      boothPackage,
      dealValueMyr,
      fairIds,
      notes: random.bool(0.3) ? 'Prefers a corner booth near the main entrance.' : null,
      createdAt: klTimestamp(-createdDaysAgo, 10, 0, now),
      updatedAt: klTimestamp(-random.int(0, createdDaysAgo), 14, 30, now),
    });
  }

  // emp-001 is the Paid employer with a booth in the next fair; emp-002 is
  // Confirmed with none yet. Both must be attached to fair-01 and fair-02 so
  // the hiring-manager flows have data.
  employers[0] = { ...employers[0], fairIds: ['fair-01', 'fair-02'], boothPackage: 'platinum', dealValueMyr: PACKAGE_PRICE_MYR.platinum };
  employers[1] = { ...employers[1], fairIds: ['fair-01', 'fair-02'], boothPackage: 'premium', dealValueMyr: PACKAGE_PRICE_MYR.premium };

  return employers;
}
