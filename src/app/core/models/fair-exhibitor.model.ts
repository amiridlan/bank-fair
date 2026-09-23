import type { CompanySize } from './employer.model';

/**
 * An employer as a job seeker may see them at a fair.
 *
 * A separate type rather than a masked `Employer`, and that is the whole point
 * (docs/11 J-D1). `Employer` carries `stage`, `dealValueMyr`, `contactEmail`,
 * `contactPhone`, `lostReason` and internal `notes` — the sales pipeline. If
 * the seeker's store held an `Employer` with those fields blanked, nothing
 * would stop a later template printing one; here there is no field to print.
 *
 * The guarantee is structural, not a rule someone has to remember.
 */
export interface FairExhibitor {
  readonly employerId: string;
  readonly name: string;
  readonly industry: string;
  readonly companySize: CompanySize;
  /** Where to find them on the day, e.g. `A-04`. */
  readonly boothCode: string;
  readonly openingCount: number;
}
