export type EmploymentType = 'full_time' | 'internship' | 'contract';

export type ExperienceLevel = 'fresh_graduate' | 'junior' | 'mid' | 'senior';

/**
 * A role an employer is hiring for, advertised at one or more fairs.
 *
 * Openings belong to the employer rather than to a fair, and name the fairs
 * they are advertised at — the same shape as `Employer.fairIds`. A company
 * attending three fairs is hiring for the same roles at all three, and
 * duplicating a row per fair would mean three records to keep in step.
 *
 * `skills` is drawn from the same vocabulary as `Candidate.skills`
 * (`SKILLS_BY_FIELD` in the seed's word lists). That is not a coincidence: it
 * is what lets the Jobs tab tell a job seeker which openings match what they
 * already have (docs/11 J-D6).
 */
export interface JobOpening {
  readonly id: string;
  readonly employerId: string;
  readonly fairIds: readonly string[];
  readonly title: string;
  /** Broad family — Engineering, Finance, Marketing — for the filter. */
  readonly jobFunction: string;
  readonly employmentType: EmploymentType;
  readonly experienceLevel: ExperienceLevel;
  readonly location: string;
  readonly skills: readonly string[];
  /**
   * Monthly gross in MYR, or null when the employer did not disclose.
   *
   * Nullable because plenty of Malaysian postings do not state a range, and a
   * seed where every row has one would never exercise the empty case
   * (docs/11 J-D5). Both ends are null together.
   */
  readonly salaryMinMyr: number | null;
  readonly salaryMaxMyr: number | null;
  /** How many people they want for this role. */
  readonly headcount: number;
  readonly postedAt: string;
}

/**
 * A job opening as a fair's listing shows it.
 *
 * The employer's name and booth code are denormalised in so the list renders
 * without a second request per row, the same reason `Booth` carries
 * `employerName`.
 */
export interface FairJobOpening extends JobOpening {
  readonly employerName: string;
  readonly boothCode: string;
}
