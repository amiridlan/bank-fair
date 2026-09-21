import type { BoothPackage } from './booth.model';

export type EmployerStage = 'lead' | 'proposal' | 'confirmed' | 'paid' | 'lost';

export type CompanySize = '1-50' | '51-200' | '201-1000' | '1000+';

export interface Employer {
  readonly id: string;
  readonly name: string;
  readonly industry: string;
  readonly companySize: CompanySize;
  readonly stage: EmployerStage;
  /** Required when `stage` is `lost`, `null` otherwise. */
  readonly lostReason: string | null;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string | null;
  readonly boothPackage: BoothPackage | null;
  /** Set once the stage reaches `proposal`; matches the booth package price. */
  readonly dealValueMyr: number | null;
  readonly fairIds: readonly string[];
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields accepted by `POST /employers` and `PATCH /employers/{id}`. */
export interface EmployerInput {
  readonly name: string;
  readonly industry: string;
  readonly companySize: CompanySize;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string | null;
  readonly boothPackage: BoothPackage | null;
  readonly notes: string | null;
}
