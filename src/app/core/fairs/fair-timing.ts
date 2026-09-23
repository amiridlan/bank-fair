import type { Fair } from '../models';

/**
 * Whether a fair is over.
 *
 * Status and dates both matter, and neither is enough alone. `completed` is a
 * decision somebody made, so it wins outright. Otherwise the end date decides:
 * a fair does not stop having happened because nobody remembered to close it,
 * and the seed carries exactly that case.
 */
export function hasEnded(fair: Fair, now: number = Date.now()): boolean {
  return fair.status === 'completed' || Date.parse(fair.endDate) < now;
}

/**
 * Whether a fair is still taking employers and registrations.
 *
 * Used by the employer's Fairs page and the job seeker's Career fairs page.
 * Status alone let an ended fair sit there as something to apply to, which is
 * an invitation nobody can accept.
 */
export function isOpenForSignup(fair: Fair, now: number = Date.now()): boolean {
  return (fair.status === 'open' || fair.status === 'live') && !hasEnded(fair, now);
}
