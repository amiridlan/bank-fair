import type { Fair } from '../../models';
import { klTimestamp } from './kl-time';

/**
 * The five demo fairs, dated relative to today so the walkthrough always has a
 * live fair, two upcoming ones, a draft and a completed one (docs/05).
 */
export function seedFairs(now: number): Fair[] {
  return [
    {
      id: 'fair-01',
      name: 'KL Career Discovery Fair',
      venue: 'Sunway Pyramid Convention Centre',
      city: 'Petaling Jaya',
      startDate: klTimestamp(0, 9, 0, now),
      endDate: klTimestamp(1, 18, 0, now),
      status: 'live',
      boothTotal: 40,
      boothAssigned: 38, // ~95%
      registrations: 2840,
      checkIns: 1612,
    },
    {
      id: 'fair-02',
      name: 'National Career Fair',
      venue: 'MITEC',
      city: 'Kuala Lumpur',
      startDate: klTimestamp(21, 9, 0, now),
      endDate: klTimestamp(22, 18, 0, now),
      status: 'open',
      boothTotal: 40,
      boothAssigned: 28, // ~70%
      registrations: 1905,
      checkIns: 0,
    },
    {
      id: 'fair-03',
      name: 'Northern Tech & Semicon Career Fair',
      venue: 'Setia SPICE Convention Centre',
      city: 'George Town',
      // Single-day fair.
      startDate: klTimestamp(45, 9, 0, now),
      endDate: klTimestamp(45, 18, 0, now),
      status: 'open',
      boothTotal: 40,
      boothAssigned: 16, // ~40%
      registrations: 742,
      checkIns: 0,
    },
    {
      id: 'fair-04',
      name: 'Southern Graduate Career Fair',
      venue: 'Persada Johor International Convention Centre',
      city: 'Johor Bahru',
      startDate: klTimestamp(90, 9, 0, now),
      endDate: klTimestamp(90, 18, 0, now),
      status: 'draft',
      boothTotal: 40,
      boothAssigned: 0,
      registrations: 0,
      checkIns: 0,
    },
    {
      id: 'fair-05',
      name: 'Graduate Career Fair (Previous)',
      venue: 'MITEC',
      city: 'Kuala Lumpur',
      startDate: klTimestamp(-60, 9, 0, now),
      endDate: klTimestamp(-59, 18, 0, now),
      status: 'completed',
      boothTotal: 40,
      boothAssigned: 40, // 100%
      registrations: 3120,
      checkIns: 2244,
    },
  ];
}
