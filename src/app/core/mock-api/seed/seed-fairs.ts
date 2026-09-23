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
      description:
        'Two days across three halls, weighted towards technology, banking and shared services. Walk-in interviews run all afternoon on both days; bring a printed CV for the booths that ask for one.',
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
      description:
        'The largest fair of the year, and the broadest: graduate intakes, internships and experienced hires across every industry on the floor. Employers confirm their booths up to a week before, so the list grows as the dates approach.',
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
      description:
        "Focused on the northern corridor's semiconductor and electronics employers, with a smaller floor and a longer queue for each booth. Most roles here are engineering, and many are open to final-year students on industrial placement.",
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
      description:
        'Graduate-level hiring for the southern region, with employers from Johor and across the causeway. Details are still being confirmed.',
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
      description:
        'A previous edition, kept for reference. The employer list and floor plan are as they were on the day.',
      startDate: klTimestamp(-60, 9, 0, now),
      endDate: klTimestamp(-59, 18, 0, now),
      status: 'completed',
      boothTotal: 40,
      boothAssigned: 40, // 100%
      registrations: 3120,
      checkIns: 2244,
    },
    {
      // Ended eight days ago and still marked open: nobody closed it out.
      // This is the case that makes "Past" worth separating from "Complete" —
      // it is a fair needing attention, not an archived one. Without it in the
      // seed the Past group would never appear.
      id: 'fair-06',
      name: 'Sarawak Digital Careers Fair',
      venue: 'Borneo Convention Centre Kuching',
      city: 'Kuching',
      description:
        'Digital and shared-services employers from across Sarawak, plus several Peninsular companies hiring for Kuching offices. The fair has finished; the listings remain for reference.',
      startDate: klTimestamp(-8, 9, 0, now),
      endDate: klTimestamp(-7, 18, 0, now),
      status: 'open',
      boothTotal: 40,
      boothAssigned: 31, // ~78%
      registrations: 1450,
      checkIns: 1102,
    },
    {
      // A second completed fair, so the Complete group is a group rather than
      // a single card.
      id: 'fair-07',
      name: 'KL Engineering Careers Fair',
      venue: 'Kuala Lumpur Convention Centre',
      city: 'Kuala Lumpur',
      description:
        'An engineering-only edition covering oil and gas, manufacturing and construction. Completed — kept for reference.',
      startDate: klTimestamp(-180, 9, 0, now),
      endDate: klTimestamp(-179, 18, 0, now),
      status: 'completed',
      boothTotal: 40,
      boothAssigned: 40, // 100%
      registrations: 2680,
      checkIns: 1980,
    },
  ];
}
