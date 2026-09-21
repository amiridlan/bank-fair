export type BoothPackage = 'standard' | 'premium' | 'platinum';

export interface Booth {
  readonly id: string;
  readonly fairId: string;
  /** Grid label shown on the tile, e.g. `A-04`. Row letter + column number. */
  readonly code: string;
  readonly row: number;
  readonly col: number;
  readonly package: BoothPackage;
  readonly priceMyr: number;
  /** `null` when the booth is unassigned. */
  readonly employerId: string | null;
  /** Denormalised so the floor plan renders without a second request. */
  readonly employerName: string | null;
}
