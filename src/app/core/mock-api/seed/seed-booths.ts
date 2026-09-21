import type { Booth, BoothPackage, Employer, Fair } from '../../models';
import { SeededRandom } from './random';
import { PACKAGE_PRICE_MYR } from './seed-employers';

const ROWS = ['A', 'B', 'C', 'D', 'E'] as const;
const COLS = 8;

/** Row A is platinum, B premium, C–E standard (docs/05). */
function packageForRow(rowIndex: number): BoothPackage {
  if (rowIndex === 0) {
    return 'platinum';
  }
  if (rowIndex === 1) {
    return 'premium';
  }
  return 'standard';
}

/**
 * 40 booths per fair (5 rows x 8 columns), filled to each fair's target rate.
 *
 * Assignment draws from the employers attached to that fair, so the floor plan
 * and the pipeline agree with each other.
 */
export function seedBooths(
  random: SeededRandom,
  fairs: readonly Fair[],
  employers: readonly Employer[],
): Booth[] {
  const booths: Booth[] = [];

  for (const fair of fairs) {
    // Only committed employers occupy a booth.
    const eligible = employers.filter(
      (employer) =>
        employer.fairIds.includes(fair.id) &&
        (employer.stage === 'confirmed' || employer.stage === 'paid'),
    );

    // How many eligible employers are deliberately left without a booth.
    // Flow F1 is "drag an unassigned employer onto a booth", so an open fair
    // that is already fully allocated would have nothing to demonstrate.
    // A draft fair has sold nothing; a completed one allocated everything.
    const heldBack = fair.status === 'draft' ? eligible.length : fair.status === 'completed' ? 0 : 4;

    const assignedCount = Math.max(0, eligible.length - heldBack);
    const occupants = random.shuffle(eligible).slice(0, assignedCount);

    // Assign to a random subset of positions rather than filling row A first,
    // so the floor plan looks like a real one with gaps.
    const positions = random.shuffle(
      Array.from({ length: ROWS.length * COLS }, (_unused, index) => index),
    );
    const occupied = new Map<number, Employer>();
    occupants.forEach((employer, index) => occupied.set(positions[index], employer));

    for (let position = 0; position < ROWS.length * COLS; position++) {
      const rowIndex = Math.floor(position / COLS);
      const colIndex = position % COLS;
      const boothPackage = packageForRow(rowIndex);
      const employer = occupied.get(position) ?? null;

      booths.push({
        id: `booth-${fair.id}-${ROWS[rowIndex]}${String(colIndex + 1).padStart(2, '0')}`,
        fairId: fair.id,
        code: `${ROWS[rowIndex]}-${String(colIndex + 1).padStart(2, '0')}`,
        row: rowIndex + 1,
        col: colIndex + 1,
        package: boothPackage,
        priceMyr: PACKAGE_PRICE_MYR[boothPackage],
        employerId: employer?.id ?? null,
        employerName: employer?.name ?? null,
      });
    }
  }

  return booths;
}
