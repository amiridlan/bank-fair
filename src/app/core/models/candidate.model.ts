export type Qualification = 'diploma' | 'degree' | 'masters' | 'phd';

/**
 * Deliberately carries no sensitive personal data — no race, religion, health
 * or disability fields. This follows the Malaysian PDPA 2010.
 */
export interface Candidate {
  readonly id: string;
  readonly fullName: string;
  readonly university: string;
  readonly fieldOfStudy: string;
  readonly qualification: Qualification;
  readonly graduationYear: number;
  /** `null` for candidates who did not supply one. */
  readonly cgpa: number | null;
  readonly skills: readonly string[];
  readonly headline: string;
  /** Masked by the API (`a***@example.com`) until the employer shortlists them. */
  readonly email: string;
  readonly phone: string | null;
  /** False while `email` and `phone` are masked. */
  readonly isContactVisible: boolean;
  readonly fairIds: readonly string[];
}
