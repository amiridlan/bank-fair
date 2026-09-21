/** Roles the portal serves. Adding one here must not require restructuring. */
export type Role = 'staff' | 'hiring_manager';

export interface User {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  /** The employer this hiring manager works for. `null` for staff. */
  readonly employerId: string | null;
}
