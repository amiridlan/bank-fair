import { buildMockDb } from './mock-db';
import { mulberry32, SeededRandom } from './seed/random';
import { klDay, klTimestamp } from './seed/kl-time';

/** Pinned so the relative dates do not depend on when the suite runs. */
const NOW = Date.parse('2026-09-21T04:00:00Z');

describe('SeededRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);

    const left = Array.from({ length: 20 }, () => a.int(0, 1000));
    const right = Array.from({ length: 20 }, () => b.int(0, 1000));

    expect(left).toEqual(right);
  });

  it('differs between seeds', () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));

    expect(a).not.toEqual(b);
  });

  it('keeps int() within the inclusive bounds', () => {
    const random = new SeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const value = random.int(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('samples distinct items and never more than the pool holds', () => {
    const random = new SeededRandom(9);
    const sample = random.sample(['a', 'b', 'c'], 10);

    expect(sample).toHaveLength(3);
    expect(new Set(sample).size).toBe(3);
  });

  it('respects weighting', () => {
    const random = new SeededRandom(11);
    const counts = { common: 0, rare: 0 };

    for (let i = 0; i < 2000; i++) {
      counts[random.weighted([['common', 95] as const, ['rare', 5] as const])]++;
    }

    expect(counts.common).toBeGreaterThan(counts.rare * 5);
  });
});

describe('Kuala Lumpur time helpers', () => {
  it('writes ISO 8601 with the +08:00 offset', () => {
    expect(klTimestamp(0, 10, 0, NOW)).toBe('2026-09-21T10:00:00+08:00');
  });

  it('rolls into the next KL day for a late-UTC instant', () => {
    // 20:00 UTC is already the next calendar day in KL.
    const lateUtc = Date.parse('2026-09-21T20:00:00Z');
    expect(klDay(0, lateUtc)).toEqual({ year: 2026, month: 9, day: 22 });
  });

  it('applies a day offset', () => {
    expect(klTimestamp(21, 9, 0, NOW)).toBe('2026-10-12T09:00:00+08:00');
  });
});

describe('buildMockDb', () => {
  it('produces the volumes docs/05 specifies', () => {
    const db = buildMockDb(NOW);

    // Farah (staff), Daniel and Priya (employer), and one job seeker.
    expect(db.users).toHaveLength(4);
    expect(db.fairs).toHaveLength(7);
    expect(db.booths).toHaveLength(280); // 40 per fair
    expect(db.employers).toHaveLength(60);
    expect(db.candidates).toHaveLength(300);
    expect(db.shortlists).toHaveLength(6);
    // 21 slots per fair DAY x 2 employers. fair-01 and fair-02 run two days
    // each, fair-03 one: (42 + 42 + 21) x 2. This asserted 126 while the seed
    // built a single day per fair, contradicting the fairs' own date ranges.
    expect(db.interviewSlots).toHaveLength(210);
    // One row per (candidate, fair) the seeder paired up, so the portal opens
    // with registrations in place rather than empty.
    expect(db.fairRegistrations).toHaveLength(
      db.candidates.reduce((total, candidate) => total + candidate.fairIds.length, 0),
    );
  });

  it('is identical across rebuilds, so the demo never shifts', () => {
    const a = buildMockDb(NOW);
    const b = buildMockDb(NOW);

    expect(a.employers.map((e) => e.name)).toEqual(b.employers.map((e) => e.name));
    expect(a.candidates.map((c) => c.fullName)).toEqual(b.candidates.map((c) => c.fullName));
  });

  it('gives every fair 40 booths across rows A to E', () => {
    const db = buildMockDb(NOW);

    for (const fair of db.fairs) {
      const booths = db.booths.filter((booth) => booth.fairId === fair.id);
      expect(booths).toHaveLength(40);
      expect(new Set(booths.map((b) => b.code.charAt(0)))).toEqual(
        new Set(['A', 'B', 'C', 'D', 'E']),
      );
    }
  });

  it('prices booths by row: A platinum, B premium, C-E standard', () => {
    const db = buildMockDb(NOW);
    const forFair = db.booths.filter((booth) => booth.fairId === 'fair-01');

    expect(forFair.filter((b) => b.row === 1).every((b) => b.package === 'platinum')).toBe(true);
    expect(forFair.filter((b) => b.row === 2).every((b) => b.package === 'premium')).toBe(true);
    expect(forFair.filter((b) => b.row >= 3).every((b) => b.package === 'standard')).toBe(true);
    expect(forFair.find((b) => b.row === 1)?.priceMyr).toBe(12_000);
  });

  it('matches the stage distribution', () => {
    const db = buildMockDb(NOW);
    const count = (stage: string) => db.employers.filter((e) => e.stage === stage).length;

    // emp-001 and emp-002 are pinned to paid/confirmed, so the shuffled plan
    // shifts by at most one in each affected bucket.
    expect(count('lead') + count('proposal') + count('confirmed') + count('paid') + count('lost')).toBe(60);
    expect(count('paid')).toBeGreaterThanOrEqual(19);
    expect(count('lost')).toBeLessThanOrEqual(4);
  });

  it('pins the two demo employers so the hiring flows have data', () => {
    const db = buildMockDb(NOW);

    expect(db.employers[0].id).toBe('emp-001');
    expect(db.employers[0].stage).toBe('paid');
    expect(db.employers[0].fairIds).toContain('fair-01');

    expect(db.employers[1].id).toBe('emp-002');
    expect(db.employers[1].stage).toBe('confirmed');
  });

  it('keeps every fair booth count in step with its assignments', () => {
    const db = buildMockDb(NOW);

    for (const fair of db.fairs) {
      const assigned = db.booths.filter(
        (booth) => booth.fairId === fair.id && booth.employerId !== null,
      ).length;
      expect(assigned).toBe(fair.boothAssigned);
    }
  });

  it('uses only fictional contact details', () => {
    const db = buildMockDb(NOW);

    expect(db.candidates.every((c) => c.email.endsWith('@example.com'))).toBe(true);
    expect(db.employers.every((e) => e.contactEmail.endsWith('.example.com'))).toBe(true);
    expect(new Set(db.candidates.map((c) => c.email)).size).toBe(300);
  });

  it('books three of the seeded shortlists into slots', () => {
    const db = buildMockDb(NOW);
    const booked = db.interviewSlots.filter((slot) => slot.candidateId !== null);

    expect(booked).toHaveLength(3);
    expect(booked.every((slot) => slot.employerId === 'emp-001')).toBe(true);
    expect(booked.every((slot) => slot.candidateName !== null)).toBe(true);
  });

  it('keeps CGPA within range and allows nulls', () => {
    const db = buildMockDb(NOW);

    for (const candidate of db.candidates) {
      if (candidate.cgpa !== null) {
        expect(candidate.cgpa).toBeGreaterThanOrEqual(2.5);
        expect(candidate.cgpa).toBeLessThanOrEqual(4);
      }
    }
    expect(db.candidates.some((c) => c.cgpa === null)).toBe(true);
  });

  it('gives every candidate 3 to 7 skills', () => {
    const db = buildMockDb(NOW);

    for (const candidate of db.candidates) {
      expect(candidate.skills.length).toBeGreaterThanOrEqual(3);
      expect(candidate.skills.length).toBeLessThanOrEqual(7);
    }
  });
});
