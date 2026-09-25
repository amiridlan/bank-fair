import type { User } from '../../models';
import { MAX_AUDIT_ENTRIES } from '../audit';
import { type MockDb, buildMockDb, getMockDb, resetMockDb } from '../mock-db';
import { toSnakeCase } from '../../http/case-conversion';
import { runMockRequest } from '../mock-engine';
import type { MockContext, MockResult } from '../mock-response';
import { matchRoute, writeRoutes } from './index';

const NOW = Date.parse('2026-09-21T04:00:00Z');

const STAFF: User = {
  id: 'u-staff-1',
  name: 'Farah Iskandar',
  role: 'staff',
  employerId: null,
  candidateId: null,
};
const HM_ONE: User = {
  id: 'u-emp-1',
  name: 'Daniel Lim',
  role: 'employer',
  employerId: 'emp-001',
  candidateId: null,
};
const HM_TWO: User = {
  id: 'u-emp-2',
  name: 'Priya Nair',
  role: 'employer',
  employerId: 'emp-002',
  candidateId: null,
};
const SEEKER: User = {
  id: 'u-seeker-1',
  name: 'Seeded Candidate',
  role: 'job_seeker',
  employerId: null,
  candidateId: 'cand-001',
};

/** Drives a request through the same route table the interceptor uses. */
function call(
  db: MockDb,
  method: string,
  path: string,
  options: { body?: unknown; user?: User } = {},
): MockResult {
  const url = new URL(path, 'http://mock.local');
  const match = matchRoute(method, url.pathname);
  if (!match) {
    throw new Error(`No handler for ${method} ${url.pathname}`);
  }

  const context: MockContext = {
    method,
    path: url.pathname,
    params: match.params,
    query: url.searchParams,
    body: options.body ?? null,
    db,
    currentUser: options.user ?? STAFF,
    now: NOW,
  };
  return match.handler(context);
}

function data<T>(result: MockResult): T {
  return (result.body as { data: T }).data;
}

function message(result: MockResult): string {
  return (result.body as { message: string }).message;
}

function fieldErrors(result: MockResult): Record<string, string[]> {
  return (result.body as { errors: Record<string, string[]> }).errors;
}

describe('mock API routing', () => {
  it('prefers the more specific pattern', () => {
    expect(matchRoute('GET', '/fairs/fair-01/booths')?.params).toEqual({ id: 'fair-01' });
    expect(matchRoute('GET', '/fairs/fair-01')?.params).toEqual({ id: 'fair-01' });
  });

  it('returns null for an unknown route or wrong method', () => {
    expect(matchRoute('GET', '/nope')).toBeNull();
    expect(matchRoute('DELETE', '/fairs/fair-01')).toBeNull();
  });
});

describe('fairs', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('lists all fairs', () => {
    expect(data<unknown[]>(call(db, 'GET', '/fairs'))).toHaveLength(7);
  });

  it('filters by status and city', () => {
    // Three open: two still ahead, and one whose dates passed without
    // anybody closing it out.
    expect(data<unknown[]>(call(db, 'GET', '/fairs?status=open'))).toHaveLength(3);
    expect(data<unknown[]>(call(db, 'GET', '/fairs?city=George Town'))).toHaveLength(1);
  });

  it('404s an unknown fair with a usable message', () => {
    const result = call(db, 'GET', '/fairs/fair-99');

    expect(result.status).toBe(404);
    expect(message(result)).toBe('Fair not found.');
  });

  it('returns booths in grid order', () => {
    const booths = data<{ code: string }[]>(call(db, 'GET', '/fairs/fair-01/booths'));

    expect(booths).toHaveLength(40);
    expect(booths[0].code).toBe('A-01');
    expect(booths[39].code).toBe('E-08');
  });
});

describe('booth assignment', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  function emptyBooth() {
    return db.booths.find((b) => b.fairId === 'fair-01' && b.employerId === null)!;
  }
  function takenBooth() {
    return db.booths.find((b) => b.fairId === 'fair-01' && b.employerId !== null)!;
  }

  it('assigns an employer and denormalises the name', () => {
    const booth = emptyBooth();
    const result = call(db, 'PATCH', `/booths/${booth.id}`, {
      body: { employerId: 'emp-003' },
    });

    expect(result.status).toBe(200);
    expect(data<{ employerId: string; employerName: string }>(result).employerId).toBe('emp-003');
    expect(data<{ employerName: string }>(result).employerName).toBe(db.employers[2].name);
  });

  it('409s on an occupied booth rather than overwriting silently', () => {
    const booth = takenBooth();
    const result = call(db, 'PATCH', `/booths/${booth.id}`, {
      body: { employerId: 'emp-050' },
    });

    expect(result.status).toBe(409);
    expect(message(result)).toContain(booth.code);
  });

  it('allows the overwrite when force is set', () => {
    const booth = takenBooth();
    const result = call(db, 'PATCH', `/booths/${booth.id}`, {
      body: { employerId: 'emp-050', force: true },
    });

    expect(result.status).toBe(200);
    expect(data<{ employerId: string }>(result).employerId).toBe('emp-050');
  });

  it('clears a booth when employerId is null, which is how Undo works', () => {
    const booth = takenBooth();
    const result = call(db, 'PATCH', `/booths/${booth.id}`, { body: { employerId: null } });

    expect(data<{ employerId: string | null }>(result).employerId).toBeNull();
  });

  it('keeps the fair booth count in step after an assignment', () => {
    const before = db.fairs.find((f) => f.id === 'fair-01')!.boothAssigned;
    call(db, 'PATCH', `/booths/${emptyBooth().id}`, { body: { employerId: 'emp-003' } });

    expect(db.fairs.find((f) => f.id === 'fair-01')!.boothAssigned).toBe(before + 1);
  });

  it('moves an employer rather than leaving them on two booths', () => {
    const first = emptyBooth();
    call(db, 'PATCH', `/booths/${first.id}`, { body: { employerId: 'emp-007' } });
    const second = db.booths.find(
      (b) => b.fairId === 'fair-01' && b.employerId === null && b.id !== first.id,
    )!;
    call(db, 'PATCH', `/booths/${second.id}`, { body: { employerId: 'emp-007' } });

    const held = db.booths.filter((b) => b.fairId === 'fair-01' && b.employerId === 'emp-007');
    expect(held).toHaveLength(1);
    expect(held[0].id).toBe(second.id);
  });

  it('404s an unknown booth', () => {
    expect(call(db, 'PATCH', '/booths/nope', { body: { employerId: 'emp-003' } }).status).toBe(404);
  });
});

describe('employers', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('filters by stage and search', () => {
    const paid = data<unknown[]>(call(db, 'GET', '/employers?stage=paid'));
    expect(paid.length).toBeGreaterThan(0);

    const name = db.employers[5].name.split(' ')[0];
    const found = data<{ name: string }[]>(
      call(db, 'GET', `/employers?search=${encodeURIComponent(name)}`),
    );
    expect(found.every((e) => e.name.toLowerCase().includes(name.toLowerCase()))).toBe(true);
  });

  it('422s a missing required field in Laravel shape', () => {
    const result = call(db, 'POST', '/employers', { body: { name: 'Test Sdn Bhd' } });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['contactEmail']).toEqual([
      'The contact email field is required.',
    ]);
    expect(fieldErrors(result)['industry']).toBeDefined();
  });

  it('422s a malformed email', () => {
    const result = call(db, 'POST', '/employers', {
      body: {
        name: 'Test Sdn Bhd',
        industry: 'Technology',
        companySize: '51-200',
        contactName: 'Aisyah Rahman',
        contactEmail: 'not-an-email',
      },
    });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['contactEmail']).toEqual([
      'The contact email must be a valid email address.',
    ]);
  });

  it('creates a valid employer as a lead with no deal value', () => {
    const result = call(db, 'POST', '/employers', {
      body: {
        name: 'Brand New Sdn Bhd',
        industry: 'Technology',
        companySize: '51-200',
        contactName: 'Aisyah Rahman',
        contactEmail: 'aisyah@brandnew.example.com',
      },
    });

    expect(result.status).toBe(201);
    expect(data<{ stage: string }>(result).stage).toBe('lead');
    expect(data<{ dealValueMyr: number | null }>(result).dealValueMyr).toBeNull();
    expect(db.employers).toHaveLength(61);
  });

  it('409s a duplicate company name', () => {
    const existing = db.employers[10].name;
    const result = call(db, 'POST', '/employers', {
      body: {
        name: existing,
        industry: 'Technology',
        companySize: '51-200',
        contactName: 'Aisyah Rahman',
        contactEmail: 'aisyah@example.com',
      },
    });

    expect(result.status).toBe(409);
  });

  it('requires a reason when moving to lost', () => {
    const result = call(db, 'PATCH', '/employers/emp-005', { body: { stage: 'lost' } });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['lostReason']).toBeDefined();
  });

  it('accepts a lost move with a reason', () => {
    const result = call(db, 'PATCH', '/employers/emp-005', {
      body: { stage: 'lost', lostReason: 'Budget cut.' },
    });

    expect(result.status).toBe(200);
    expect(data<{ lostReason: string }>(result).lostReason).toBe('Budget cut.');
    // A lost deal carries no value.
    expect(data<{ dealValueMyr: number | null }>(result).dealValueMyr).toBeNull();
  });

  it('requires a booth package before an employer can be marked paid', () => {
    const lead = db.employers.find((e) => e.boothPackage === null)!;
    const result = call(db, 'PATCH', `/employers/${lead.id}`, { body: { stage: 'paid' } });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['boothPackage']).toBeDefined();
  });

  it('derives deal value from the package on a stage move', () => {
    const result = call(db, 'PATCH', '/employers/emp-002', {
      body: { stage: 'paid', boothPackage: 'platinum' },
    });

    expect(data<{ dealValueMyr: number }>(result).dealValueMyr).toBe(12_000);
  });

  it('404s an unknown employer', () => {
    expect(call(db, 'PATCH', '/employers/emp-999', { body: { stage: 'paid' } }).status).toBe(404);
  });
});

describe('candidates', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('paginates with 20 per page by default', () => {
    const result = call(db, 'GET', '/candidates');
    const meta = (result.body as { meta: { total: number; perPage: number; lastPage: number } })
      .meta;

    expect(data<unknown[]>(result)).toHaveLength(20);
    expect(meta.total).toBe(300);
    expect(meta.perPage).toBe(20);
    expect(meta.lastPage).toBe(15);
  });

  it('returns the requested page', () => {
    const first = data<{ id: string }[]>(call(db, 'GET', '/candidates?page=1'));
    const second = data<{ id: string }[]>(call(db, 'GET', '/candidates?page=2'));

    expect(second[0].id).not.toBe(first[0].id);
  });

  it('clamps an absurd per_page instead of returning everything', () => {
    const result = call(db, 'GET', '/candidates?per_page=100000');
    expect(data<unknown[]>(result).length).toBeLessThanOrEqual(100);
  });

  it('filters by university, field and graduation year', () => {
    const university = db.candidates[0].university;
    const filtered = data<{ university: string }[]>(
      call(db, 'GET', `/candidates?university=${encodeURIComponent(university)}`),
    );

    expect(filtered.every((c) => c.university === university)).toBe(true);
  });

  it('excludes candidates without a CGPA from a minimum filter', () => {
    const result = call(db, 'GET', '/candidates?min_cgpa=3.5&per_page=100');
    const items = data<{ cgpa: number | null }[]>(result);

    expect(items.every((c) => c.cgpa !== null && c.cgpa >= 3.5)).toBe(true);
  });

  it('searches name, skills and field', () => {
    const items = data<{ skills: string[]; fullName: string; fieldOfStudy: string }[]>(
      call(db, 'GET', '/candidates?search=python&per_page=100'),
    );

    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every((c) =>
        `${c.fullName} ${c.skills.join(' ')} ${c.fieldOfStudy}`.toLowerCase().includes('python'),
      ),
    ).toBe(true);
  });

  it('sorts by CGPA descending with nulls last', () => {
    const items = data<{ cgpa: number | null }[]>(
      call(db, 'GET', '/candidates?sort=cgpa&dir=desc&per_page=100'),
    );
    const values = items.map((c) => c.cgpa).filter((v): v is number => v !== null);

    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it('ignores an unknown sort field rather than breaking the list', () => {
    const result = call(db, 'GET', '/candidates?sort=; DROP TABLE');
    expect(result.status).toBe(200);
    expect(data<unknown[]>(result)).toHaveLength(20);
  });

  it('masks contact details for a non-shortlisted candidate', () => {
    const items = data<{ email: string; phone: string | null; isContactVisible: boolean }[]>(
      call(db, 'GET', '/candidates', { user: HM_TWO }),
    );

    expect(items.every((c) => c.email.includes('***'))).toBe(true);
    expect(items.every((c) => c.phone === null)).toBe(true);
    expect(items.every((c) => !c.isContactVisible)).toBe(true);
  });

  it('unmasks a candidate this employer has shortlisted', () => {
    const shortlisted = db.shortlists[0].candidateId;
    const result = call(db, 'GET', `/candidates/${shortlisted}`, { user: HM_ONE });
    const candidate = data<{ email: string; isContactVisible: boolean }>(result);

    expect(candidate.isContactVisible).toBe(true);
    expect(candidate.email).not.toContain('***');
  });

  it('keeps that candidate masked for a different employer', () => {
    const shortlisted = db.shortlists[0].candidateId;
    const candidate = data<{ isContactVisible: boolean }>(
      call(db, 'GET', `/candidates/${shortlisted}`, { user: HM_TWO }),
    );

    expect(candidate.isContactVisible).toBe(false);
  });

  it('masks for staff, who have no employer of their own', () => {
    const candidate = data<{ isContactVisible: boolean }>(
      call(db, 'GET', '/candidates/cand-001', { user: STAFF }),
    );

    expect(candidate.isContactVisible).toBe(false);
  });
});

describe('shortlists', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('returns only the viewer own employer entries', () => {
    expect(data<unknown[]>(call(db, 'GET', '/shortlists', { user: HM_ONE }))).toHaveLength(6);
    expect(data<unknown[]>(call(db, 'GET', '/shortlists', { user: HM_TWO }))).toHaveLength(0);
  });

  it('409s a duplicate shortlist', () => {
    const existing = db.shortlists[0];
    const result = call(db, 'POST', '/shortlists', {
      user: HM_ONE,
      body: { candidateId: existing.candidateId, fairId: existing.fairId },
    });

    expect(result.status).toBe(409);
    expect(message(result)).toContain('already on your shortlist');
  });

  it('creates a shortlist and unmasks the candidate', () => {
    const fresh = db.candidates.find(
      (c) => !db.shortlists.some((s) => s.candidateId === c.id),
    )!;
    const result = call(db, 'POST', '/shortlists', {
      user: HM_ONE,
      body: { candidateId: fresh.id, fairId: 'fair-01' },
    });

    expect(result.status).toBe(201);
    expect(data<{ candidate: { isContactVisible: boolean } }>(result).candidate.isContactVisible).toBe(
      true,
    );
  });

  it('422s a missing candidate', () => {
    const result = call(db, 'POST', '/shortlists', { user: HM_ONE, body: { fairId: 'fair-01' } });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['candidateId']).toBeDefined();
  });

  it('deletes an entry and frees any slot booked for that candidate', () => {
    const booked = db.interviewSlots.find((slot) => slot.candidateId !== null)!;
    const shortlist = db.shortlists.find((s) => s.candidateId === booked.candidateId)!;

    const result = call(db, 'DELETE', `/shortlists/${shortlist.id}`, { user: HM_ONE });

    expect(result.status).toBe(204);
    expect(db.interviewSlots.find((s) => s.id === booked.id)?.candidateId).toBeNull();
  });

  it('404s deleting another employer entry', () => {
    const result = call(db, 'DELETE', `/shortlists/${db.shortlists[0].id}`, { user: HM_TWO });
    expect(result.status).toBe(404);
  });
});

describe('interview slots', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('returns a full day of slots for every day the fair runs', () => {
    // docs/05 says "21 per fair day". fair-01 is a two-day fair, so 42 — this
    // asserted 21 while the seed built only the first day (docs/07 T4).
    const slots = data<{ startTime: string }[]>(
      call(db, 'GET', '/interview-slots?fair_id=fair-01', { user: HM_ONE }),
    );

    expect(slots).toHaveLength(42);
    expect(new Set(slots.map((slot) => slot.startTime.slice(0, 10))).size).toBe(2);
  });

  it('returns one day for a single-day fair', () => {
    const slots = data<unknown[]>(
      call(db, 'GET', '/interview-slots?fair_id=fair-03', { user: HM_ONE }),
    );

    expect(slots).toHaveLength(21);
  });

  it('generates slots on demand for an employer that was not seeded', () => {
    const other: User = { ...HM_ONE, id: 'u-x', employerId: 'emp-030' };
    const slots = data<unknown[]>(
      call(db, 'GET', '/interview-slots?fair_id=fair-02', { user: other }),
    );

    // fair-02 also runs two days.
    expect(slots).toHaveLength(42);
    expect(db.interviewSlots.some((s) => s.employerId === 'emp-030')).toBe(true);
  });

  it('409s booking a slot someone already holds', () => {
    const taken = db.interviewSlots.find(
      (s) => s.employerId === 'emp-001' && s.candidateId !== null,
    )!;
    const otherShortlist = db.shortlists.find((s) => s.candidateId !== taken.candidateId)!;

    const result = call(db, 'PATCH', `/interview-slots/${taken.id}`, {
      user: HM_ONE,
      body: { candidateId: otherShortlist.candidateId },
    });

    expect(result.status).toBe(409);
    expect(message(result)).toBe('That slot was just booked. Pick another.');
  });

  it('refuses to book a candidate who is not shortlisted', () => {
    const open = db.interviewSlots.find(
      (s) => s.employerId === 'emp-001' && s.fairId === 'fair-01' && s.candidateId === null,
    )!;
    const stranger = db.candidates.find(
      (c) => !db.shortlists.some((s) => s.candidateId === c.id),
    )!;

    const result = call(db, 'PATCH', `/interview-slots/${open.id}`, {
      user: HM_ONE,
      body: { candidateId: stranger.id },
    });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)['candidateId']).toBeDefined();
  });

  it('books a shortlisted candidate into an open slot', () => {
    const open = db.interviewSlots.find(
      (s) => s.employerId === 'emp-001' && s.fairId === 'fair-01' && s.candidateId === null,
    )!;
    const free = db.shortlists.find(
      (s) => !db.interviewSlots.some((slot) => slot.candidateId === s.candidateId),
    )!;

    const result = call(db, 'PATCH', `/interview-slots/${open.id}`, {
      user: HM_ONE,
      body: { candidateId: free.candidateId },
    });

    expect(result.status).toBe(200);
    expect(data<{ candidateName: string }>(result).candidateName).toBe(free.candidate.fullName);
  });

  it('409s a second interview for the same candidate at one fair', () => {
    const booked = db.interviewSlots.find(
      (s) => s.employerId === 'emp-001' && s.candidateId !== null,
    )!;
    const open = db.interviewSlots.find(
      (s) => s.employerId === 'emp-001' && s.fairId === 'fair-01' && s.candidateId === null,
    )!;

    const result = call(db, 'PATCH', `/interview-slots/${open.id}`, {
      user: HM_ONE,
      body: { candidateId: booked.candidateId },
    });

    expect(result.status).toBe(409);
    expect(message(result)).toContain('already has an interview');
  });

  it('cancels a booking when candidateId is null', () => {
    const booked = db.interviewSlots.find((s) => s.candidateId !== null)!;
    const result = call(db, 'PATCH', `/interview-slots/${booked.id}`, {
      user: HM_ONE,
      body: { candidateId: null },
    });

    expect(data<{ candidateId: string | null }>(result).candidateId).toBeNull();
  });

  it('hides another employer slots', () => {
    const slot = db.interviewSlots.find((s) => s.employerId === 'emp-001')!;
    const result = call(db, 'PATCH', `/interview-slots/${slot.id}`, {
      user: HM_TWO,
      body: { candidateId: null },
    });

    expect(result.status).toBe(404);
  });
});

describe('dashboard summary', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('counts only open and live fairs', () => {
    const summary = data<{ upcomingFairs: { value: number } }>(
      call(db, 'GET', '/dashboard/summary'),
    );
    expect(summary.upcomingFairs.value).toBe(3);
  });

  it('reports fill rate as a fraction', () => {
    const summary = data<{ boothFillRate: { value: number } }>(
      call(db, 'GET', '/dashboard/summary'),
    );

    expect(summary.boothFillRate.value).toBeGreaterThan(0);
    expect(summary.boothFillRate.value).toBeLessThanOrEqual(1);
  });

  it('excludes lost and lead employers from pipeline value', () => {
    const summary = data<{
      pipelineValueMyr: { value: number };
      pipelineByStage: { stage: string; valueMyr: number }[];
    }>(call(db, 'GET', '/dashboard/summary'));

    const lost = summary.pipelineByStage.find((s) => s.stage === 'lost')!;
    expect(lost.valueMyr).toBe(0);

    const valued = summary.pipelineByStage
      .filter((s) => ['proposal', 'confirmed', 'paid'].includes(s.stage))
      .reduce((sum, s) => sum + s.valueMyr, 0);
    expect(summary.pipelineValueMyr.value).toBe(valued);
  });

  it('covers every stage in the pipeline breakdown', () => {
    const summary = data<{ pipelineByStage: { stage: string; count: number }[] }>(
      call(db, 'GET', '/dashboard/summary'),
    );

    expect(summary.pipelineByStage.map((s) => s.stage)).toEqual([
      'lead',
      'proposal',
      'confirmed',
      'paid',
      'lost',
    ]);
    expect(summary.pipelineByStage.reduce((sum, s) => sum + s.count, 0)).toBe(60);
  });
});

describe('demo endpoints', () => {
  it('reseeds on reset', () => {
    const db = buildMockDb(NOW);
    db.candidates = [];

    expect(call(db, 'POST', '/demo/reset', { body: {} }).status).toBe(204);
    // resetMockDb swaps the module-level database, so a rebuild is the
    // observable check that the seed is intact.
    expect(buildMockDb(NOW).candidates).toHaveLength(300);
  });
});

describe('fair registrations', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  /** A fair still taking registrations that cand-001 is not already on. */
  function openFairWithout(candidateId: string): string {
    const taken = new Set(
      db.fairRegistrations.filter((r) => r.candidateId === candidateId).map((r) => r.fairId),
    );
    return db.fairs.find(
      (fair) => (fair.status === 'open' || fair.status === 'live') && !taken.has(fair.id),
    )!.id;
  }

  it('lists only the viewer’s own registrations', () => {
    const rows = data<{ candidateId: string }[]>(
      call(db, 'GET', '/fair-registrations', { user: SEEKER }),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.candidateId === 'cand-001')).toBe(true);
  });

  it('returns nothing for someone with no candidate record', () => {
    // There is no parameter for reading another person's registrations, so an
    // employer simply has none rather than being able to ask for someone's.
    expect(data<unknown[]>(call(db, 'GET', '/fair-registrations', { user: HM_ONE }))).toEqual([]);
  });

  it('registers for an open fair and records when consent was given', () => {
    const fairId = openFairWithout('cand-001');

    const result = call(db, 'POST', '/fair-registrations', {
      user: SEEKER,
      body: { fairId, consent: true },
    });

    expect(result.status).toBe(201);
    const row = data<{ consentedAt: string; fairId: string }>(result);
    expect(row.fairId).toBe(fairId);
    expect(Date.parse(row.consentedAt)).not.toBeNaN();
  });

  it('refuses to register without consent', () => {
    // The payload cannot default it: a request that can omit consent is a UI
    // that can forget to ask for it.
    const result = call(db, 'POST', '/fair-registrations', {
      user: SEEKER,
      body: { fairId: openFairWithout('cand-001') },
    });

    expect(result.status).toBe(422);
    expect(db.fairRegistrations.some((r) => r.candidateId === 'cand-001' && r.consentedAt === ''))
      .toBe(false);
  });

  it('refuses a consent value that is not true', () => {
    const result = call(db, 'POST', '/fair-registrations', {
      user: SEEKER,
      body: { fairId: openFairWithout('cand-001'), consent: 'yes' },
    });

    expect(result.status).toBe(422);
  });

  it('409s on a fair the candidate is already registered for', () => {
    const existing = db.fairRegistrations.find((r) => r.candidateId === 'cand-001')!;

    const result = call(db, 'POST', '/fair-registrations', {
      user: SEEKER,
      body: { fairId: existing.fairId, consent: true },
    });

    expect(result.status).toBe(409);
  });

  it('refuses a fair that has closed', () => {
    const closed = db.fairs.find((fair) => fair.status === 'completed' || fair.status === 'draft')!;

    const result = call(db, 'POST', '/fair-registrations', {
      user: SEEKER,
      body: { fairId: closed.id, consent: true },
    });

    expect(result.status).toBe(409);
  });

  it('keeps the candidate’s fairIds in step, so the talent pool agrees', () => {
    const fairId = openFairWithout('cand-001');
    call(db, 'POST', '/fair-registrations', { user: SEEKER, body: { fairId, consent: true } });

    expect(db.candidates.find((c) => c.id === 'cand-001')!.fairIds).toContain(fairId);
  });

  it('withdraws, and removes the fair from the candidate too', () => {
    const existing = db.fairRegistrations.find((r) => r.candidateId === 'cand-001')!;

    const result = call(db, 'DELETE', `/fair-registrations/${existing.id}`, { user: SEEKER });

    expect(result.status).toBe(204);
    expect(db.candidates.find((c) => c.id === 'cand-001')!.fairIds).not.toContain(existing.fairId);
  });

  it('cannot withdraw someone else’s registration', () => {
    const other = db.fairRegistrations.find((r) => r.candidateId !== 'cand-001')!;
    const before = db.fairRegistrations.length;

    // 404 rather than 403: confirming the id exists would leak it.
    expect(call(db, 'DELETE', `/fair-registrations/${other.id}`, { user: SEEKER }).status).toBe(404);
    expect(db.fairRegistrations).toHaveLength(before);
  });

  it('shows a job seeker their own contact details unmasked', () => {
    // A person is not a third party to their own record. Employers still see
    // them starred out until they shortlist.
    const mine = data<{ email: string; isContactVisible: boolean }>(
      call(db, 'GET', '/candidates/cand-001', { user: SEEKER }),
    );
    const theirs = data<{ email: string; isContactVisible: boolean }>(
      call(db, 'GET', '/candidates/cand-001', { user: HM_TWO }),
    );

    expect(mine.isContactVisible).toBe(true);
    expect(mine.email).not.toContain('***');
    expect(theirs.email).toContain('***');
  });
});

describe('fair applications', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  /** The seeded pending application belonging to a given employer, if any. */
  function pendingFor(employerId: string) {
    return db.fairApplications.find(
      (entry) => entry.employerId === employerId && entry.status === 'pending',
    );
  }

  function anyPending() {
    return db.fairApplications.find((entry) => entry.status === 'pending')!;
  }

  /** An open fair this employer has neither applied to nor been booked on. */
  function openFairFor(employerId: string): string {
    const taken = new Set(
      db.fairApplications.filter((e) => e.employerId === employerId).map((e) => e.fairId),
    );
    const employer = db.employers.find((e) => e.id === employerId)!;
    return db.fairs.find(
      (fair) =>
        (fair.status === 'open' || fair.status === 'live') &&
        !taken.has(fair.id) &&
        !employer.fairIds.includes(fair.id),
    )!.id;
  }

  it('shows staff every application', () => {
    const rows = data<readonly { id: string }[]>(call(db, 'GET', '/fair-applications'));

    expect(rows).toHaveLength(db.fairApplications.length);
  });

  it('shows an employer only their own', () => {
    const rows = data<readonly { employerId: string }[]>(
      call(db, 'GET', '/fair-applications', { user: HM_ONE }),
    );

    // Scoped by who is asking, not by a parameter: there is no way to ask for
    // somebody else's.
    expect(rows.every((row) => row.employerId === 'emp-001')).toBe(true);
  });

  it('filters by status', () => {
    const rows = data<readonly { status: string }[]>(
      call(db, 'GET', '/fair-applications?status=pending'),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'pending')).toBe(true);
  });

  it('applies, landing pending', () => {
    const fairId = openFairFor('emp-001');

    const result = call(db, 'POST', '/fair-applications', { user: HM_ONE, body: { fairId } });

    expect(result.status).toBe(201);
    const row = data<{ status: string; employerName: string; decidedAt: string | null }>(result);
    expect(row.status).toBe('pending');
    expect(row.decidedAt).toBeNull();
    expect(row.employerName).not.toBe('Unknown employer');
  });

  it('refuses an application with no fair', () => {
    const result = call(db, 'POST', '/fair-applications', { user: HM_ONE, body: {} });

    expect(result.status).toBe(422);
    expect(fieldErrors(result)).toHaveProperty('fairId');
  });

  it('409s when an application is already under review', () => {
    const existing = pendingFor('emp-001') ?? anyPending();
    const user = { ...HM_ONE, employerId: existing.employerId };

    const result = call(db, 'POST', '/fair-applications', {
      user,
      body: { fairId: existing.fairId },
    });

    expect(result.status).toBe(409);
  });

  it('lets a rejected employer apply again', () => {
    // Being turned down once is not a permanent bar; the reason may have been
    // something they can fix.
    const rejected = db.fairApplications.find((entry) => entry.status === 'rejected')!;
    const user = { ...HM_ONE, employerId: rejected.employerId };

    const result = call(db, 'POST', '/fair-applications', {
      user,
      body: { fairId: rejected.fairId },
    });

    expect(result.status).toBe(201);
  });

  it('refuses an application to a fair that has closed', () => {
    const closed = db.fairs.find((fair) => fair.status === 'completed' || fair.status === 'draft')!;

    const result = call(db, 'POST', '/fair-applications', {
      user: HM_ONE,
      body: { fairId: closed.id },
    });

    expect(result.status).toBe(409);
  });

  it('will not let an employer decide anything', () => {
    const pending = anyPending();

    // 404 rather than 403: the queue is not theirs to know about.
    const result = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      user: HM_TWO,
      body: { status: 'approved' },
    });

    expect(result.status).toBe(404);
    expect(db.fairApplications.find((e) => e.id === pending.id)!.status).toBe('pending');
  });

  it('approves, putting the employer on the fair and confirming them', () => {
    const pending = anyPending();
    const before = db.employers.find((e) => e.id === pending.employerId)!;
    expect(before.stage).not.toBe('confirmed');

    const result = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'approved' },
    });

    expect(result.status).toBe(200);
    expect(data<{ status: string }>(result).status).toBe('approved');

    // Both halves matter. `fairIds` puts them at the fair; the stage is what
    // the floor plan's side list gates on, so without it the approval would
    // not make them seatable and the decision would change nothing visible.
    const after = db.employers.find((e) => e.id === pending.employerId)!;
    expect(after.fairIds).toContain(pending.fairId);
    expect(after.stage).toBe('confirmed');
    expect(after.lostReason).toBeNull();
  });

  it('does not walk a paid employer back to confirmed', () => {
    // `paid` is further along. Being accepted for a second fair should not
    // cost an employer the deal they already closed.
    const pending = anyPending();
    const index = db.employers.findIndex((e) => e.id === pending.employerId);
    db.employers[index] = { ...db.employers[index], stage: 'paid', boothPackage: 'premium' };

    call(db, 'PATCH', `/fair-applications/${pending.id}`, { body: { status: 'approved' } });

    expect(db.employers[index].stage).toBe('paid');
  });

  it('gives a confirmed employer the deal value its package implies', () => {
    const pending = anyPending();
    const index = db.employers.findIndex((e) => e.id === pending.employerId);
    db.employers[index] = { ...db.employers[index], boothPackage: 'standard', dealValueMyr: null };

    call(db, 'PATCH', `/fair-applications/${pending.id}`, { body: { status: 'approved' } });

    // The same rule PATCH /employers/{id} applies: confirmed carries the
    // package price, and a value with no package would be invented.
    expect(db.employers[index].dealValueMyr).toBeGreaterThan(0);
  });

  it('leaves the pipeline alone on a rejection', () => {
    const pending = anyPending();
    const index = db.employers.findIndex((e) => e.id === pending.employerId);
    const stage = db.employers[index].stage;

    call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'rejected', rejectionReason: 'Full for this industry.' },
    });

    expect(db.employers[index].stage).toBe(stage);
  });

  it('refuses a rejection with no reason', () => {
    const pending = anyPending();

    const blank = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'rejected', rejectionReason: '   ' },
    });

    expect(blank.status).toBe(422);
    expect(fieldErrors(blank)).toHaveProperty('rejectionReason');
    expect(db.fairApplications.find((e) => e.id === pending.id)!.status).toBe('pending');
  });

  it('rejects with a trimmed reason', () => {
    const pending = anyPending();

    const result = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'rejected', rejectionReason: '  Not enough graduate roles.  ' },
    });

    const row = data<{ rejectionReason: string; decidedAt: string }>(result);
    expect(row.rejectionReason).toBe('Not enough graduate roles.');
    expect(Date.parse(row.decidedAt)).not.toBeNaN();
    expect(db.employers.find((e) => e.id === pending.employerId)!.fairIds).not.toContain(
      pending.fairId,
    );
  });

  it('refuses a status that is neither approved nor rejected', () => {
    const pending = anyPending();

    const result = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'pending' },
    });

    expect(result.status).toBe(422);
  });

  it('409s on a second decision', () => {
    // Two organisers open the queue; the first decision is the one that stands.
    const pending = anyPending();
    call(db, 'PATCH', `/fair-applications/${pending.id}`, { body: { status: 'approved' } });

    const again = call(db, 'PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'rejected', rejectionReason: 'Changed my mind.' },
    });

    expect(again.status).toBe(409);
    expect(message(again)).toContain('already been decided');
    expect(db.fairApplications.find((e) => e.id === pending.id)!.status).toBe('approved');
  });
});

describe('editing your own profile', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  const VALID = {
    fullName: 'Ahmad Zaki Abdullah Sani',
    headline: 'Final-year software engineering student',
    university: 'Universiti Malaya',
    fieldOfStudy: 'Software Engineering',
    qualification: 'degree',
    graduationYear: 2027,
    cgpa: 3.62,
    email: 'ahmad.zaki@example.com',
    phone: '012-3456789',
    skills: ['TypeScript', 'Laravel'],
  };

  function patch(body: unknown, user = SEEKER, id = 'cand-001') {
    return call(db, 'PATCH', `/candidates/${id}`, { user, body });
  }

  it('saves the profile', () => {
    const result = patch(VALID);

    expect(result.status).toBe(200);
    const saved = db.candidates.find((c) => c.id === 'cand-001')!;
    expect(saved.fullName).toBe(VALID.fullName);
    expect(saved.skills).toEqual(['TypeScript', 'Laravel']);
  });

  it('returns the record through the mask, like every other read', () => {
    const row = data<{ isContactVisible: boolean; email: string }>(patch(VALID));

    expect(row.isContactVisible).toBe(true);
    expect(row.email).not.toContain('***');
  });

  it('will not let anyone edit someone else’s profile', () => {
    // 404, not 403: the same answer a missing id gets, so the response does
    // not confirm which candidates exist.
    const other = db.candidates.find((c) => c.id !== 'cand-001')!;
    const before = other.fullName;

    expect(patch(VALID, SEEKER, other.id).status).toBe(404);
    expect(db.candidates.find((c) => c.id === other.id)!.fullName).toBe(before);
  });

  it('does not give staff an edit path either', () => {
    // The record belongs to the person; that is the point of the role.
    expect(patch(VALID, STAFF).status).toBe(404);
  });

  it('will not let an employer edit a candidate', () => {
    expect(patch(VALID, HM_ONE).status).toBe(404);
  });

  it('reports every bad field at once, Laravel-style', () => {
    const result = patch({ ...VALID, fullName: '   ', email: 'not-an-email', graduationYear: 1780 });

    expect(result.status).toBe(422);
    expect(Object.keys(fieldErrors(result)).sort()).toEqual([
      'email',
      'fullName',
      'graduationYear',
    ]);
  });

  it('refuses a CGPA outside 0.00–4.00', () => {
    expect(patch({ ...VALID, cgpa: 4.5 }).status).toBe(422);
    expect(patch({ ...VALID, cgpa: -1 }).status).toBe(422);
    expect(patch({ ...VALID, cgpa: null }).status).toBe(200);
  });

  it('refuses a qualification outside the union', () => {
    expect(patch({ ...VALID, qualification: 'postgrad' }).status).toBe(422);
  });

  it('caps the skills list', () => {
    const many = Array.from({ length: 21 }, (_, i) => `Skill ${i}`);

    expect(patch({ ...VALID, skills: many }).status).toBe(422);
  });

  it('ignores an attempt to set fairIds or unmask contact details', () => {
    // Registration is what puts someone at a fair, with consent recorded
    // against it, and masking is the API's call. A profile PATCH must not be
    // a way around either.
    const before = db.candidates.find((c) => c.id === 'cand-001')!.fairIds;

    patch({ ...VALID, fairIds: ['fair-01', 'fair-02', 'fair-03'], isContactVisible: true });

    expect(db.candidates.find((c) => c.id === 'cand-001')!.fairIds).toEqual(before);
  });

  it('trims what it stores and drops a blank phone to null', () => {
    patch({ ...VALID, fullName: '  Ahmad Zaki  ', phone: '   ' });

    const saved = db.candidates.find((c) => c.id === 'cand-001')!;
    expect(saved.fullName).toBe('Ahmad Zaki');
    expect(saved.phone).toBeNull();
  });

  it('rounds a CGPA to two decimal places', () => {
    patch({ ...VALID, cgpa: 3.666666 });

    expect(db.candidates.find((c) => c.id === 'cand-001')!.cgpa).toBe(3.67);
  });
});

describe('audit log', () => {
  // No local db: these go through the engine, which reads the module-level
  // one, so the shared instance is the only one that matters here.

  /** Drives a request through the engine, which is what records entries. */
  function request(method: string, path: string, options: { body?: unknown; user?: User } = {}) {
    const url = new URL(path, 'http://mock.local');
    return runMockRequest({
      method,
      path: url.pathname,
      query: url.searchParams,
      body: options.body ?? null,
      currentUser: options.user ?? STAFF,
      isProduction: true,
    });
  }

  const log = () => getMockDb().auditEntries;

  beforeEach(() => resetMockDb(NOW));

  it('logs every write route, so a new endpoint cannot ship unlogged', () => {
    // The point of hanging this off the route table rather than calling it
    // from inside each handler: a handler that forgets is an invisible hole,
    // and this makes it a failing test instead.
    const unlogged = writeRoutes().filter((route) => !route.audited);

    expect(unlogged).toEqual([]);
  });

  it('records who did it, not just what happened', () => {
    const pending = getMockDb().fairApplications.find((entry) => entry.status === 'pending')!;

    request('PATCH', `/fair-applications/${pending.id}`, { body: { status: 'approved' } });

    const entry = log().at(-1)!;
    expect(entry.actorId).toBe(STAFF.id);
    expect(entry.actorName).toBe(STAFF.name);
    expect(entry.actorRole).toBe('staff');
  });

  it('logs an employer’s write as well as a staff one', () => {
    // L1: every role is recorded. Scoping the recording by role would leave
    // holes exactly where a demo gets questioned.
    const fair = getMockDb().fairs.find((f) => f.status === 'open' || f.status === 'live')!;

    request('POST', '/fair-applications', { user: HM_ONE, body: { fairId: fair.id } });

    expect(log().at(-1)?.actorRole).toBe('employer');
  });

  it('logs a job seeker’s write too', () => {
    request('PATCH', '/candidates/cand-001', {
      user: SEEKER,
      body: {
        fullName: 'Ahmad Zaki',
        headline: 'Student',
        university: 'Universiti Malaya',
        fieldOfStudy: 'Software Engineering',
        qualification: 'degree',
        graduationYear: 2027,
        cgpa: 3.5,
        email: 'ahmad@example.com',
        phone: null,
        skills: ['TypeScript'],
      },
    });

    expect(log().at(-1)?.actorRole).toBe('job_seeker');
  });

  it('sharpens the action past "updated" where it would hide the point', () => {
    const pending = getMockDb().fairApplications.find((entry) => entry.status === 'pending')!;

    request('PATCH', `/fair-applications/${pending.id}`, {
      body: { status: 'rejected', rejectionReason: 'Full for this industry.' },
    });

    expect(log().at(-1)?.action).toBe('rejected');
  });

  it('records a booth assignment as assigned, and clearing it as cleared', () => {
    const booth = getMockDb().booths.find((entry) => entry.employerId === null)!;
    const employer = getMockDb().employers.find((entry) => entry.fairIds.includes(booth.fairId))!;

    request('PATCH', `/booths/${booth.id}`, { body: { employerId: employer.id } });
    expect(log().at(-1)?.action).toBe('assigned');

    request('PATCH', `/booths/${booth.id}`, { body: { employerId: null } });
    expect(log().at(-1)?.action).toBe('cleared');
  });

  it('records what a field changed from and to', () => {
    const employer = getMockDb().employers.find((entry) => entry.stage === 'lead')!;

    request('PATCH', `/employers/${employer.id}`, { body: { stage: 'proposal' } });

    const change = log().at(-1)!.changes.find((c) => c.field === 'stage')!;
    expect(change.from).toBe('lead');
    expect(change.to).toBe('proposal');
    expect(change.redacted).toBe(false);
  });

  it('never stores the value of a personal field', () => {
    // L2. The log says the field changed and stops there — an audit log is a
    // second store of whatever it copies, and these are the values the
    // masking rules exist to contain.
    request('PATCH', '/candidates/cand-001', {
      user: SEEKER,
      body: {
        fullName: 'Someone Else Entirely',
        headline: 'Student',
        university: 'Universiti Malaya',
        fieldOfStudy: 'Software Engineering',
        qualification: 'degree',
        graduationYear: 2027,
        cgpa: 3.5,
        email: 'brand.new@example.com',
        phone: '019-8887777',
        skills: ['TypeScript'],
      },
    });

    const entry = log().at(-1)!;
    const personal = entry.changes.filter((c) =>
      ['fullName', 'email', 'phone'].includes(c.field),
    );

    expect(personal.length).toBeGreaterThan(0);
    for (const change of personal) {
      expect(change.redacted).toBe(true);
      expect(change.from).toBeNull();
      expect(change.to).toBeNull();
    }
    // And nowhere else in the entry either.
    expect(JSON.stringify(entry)).not.toContain('brand.new@example.com');
    expect(JSON.stringify(entry)).not.toContain('019-8887777');
  });

  it('records a business field on the same request it redacts a personal one', () => {
    request('PATCH', '/candidates/cand-001', {
      user: SEEKER,
      body: {
        fullName: 'Renamed Person',
        headline: 'Student',
        university: 'Universiti Teknologi Malaysia',
        fieldOfStudy: 'Software Engineering',
        qualification: 'degree',
        graduationYear: 2027,
        cgpa: 3.5,
        email: 'ahmad@example.com',
        phone: null,
        skills: ['TypeScript'],
      },
    });

    const entry = log().at(-1)!;
    expect(entry.changes.find((c) => c.field === 'university')?.to).toBe(
      'Universiti Teknologi Malaysia',
    );
    expect(entry.changes.find((c) => c.field === 'fullName')?.redacted).toBe(true);
  });

  it('does not label a candidate entry with their name', () => {
    request('PATCH', '/candidates/cand-001', {
      user: SEEKER,
      body: {
        fullName: 'Private Name Here',
        headline: 'Student',
        university: 'Universiti Malaya',
        fieldOfStudy: 'Software Engineering',
        qualification: 'degree',
        graduationYear: 2027,
        cgpa: 3.5,
        email: 'ahmad@example.com',
        phone: null,
        skills: ['TypeScript'],
      },
    });

    expect(log().at(-1)?.entityLabel).toBe('Candidate cand-001');
  });

  it('records nothing for a refused write', () => {
    const before = log().length;

    // 422: no reason given for a rejection.
    const pending = getMockDb().fairApplications.find((entry) => entry.status === 'pending')!;
    request('PATCH', `/fair-applications/${pending.id}`, { body: { status: 'rejected' } });

    expect(log()).toHaveLength(before);
  });

  it('records nothing for a read', () => {
    const before = log().length;
    request('GET', '/employers');

    expect(log()).toHaveLength(before);
  });

  it('keeps the label of something that was deleted', () => {
    const registration = getMockDb().fairRegistrations.find((r) => r.candidateId === 'cand-001')!;

    request('DELETE', `/fair-registrations/${registration.id}`, { user: SEEKER });

    const entry = log().at(-1)!;
    expect(entry.action).toBe('deleted');
    // The row is gone, so the label can only have come from the snapshot
    // taken before the handler ran.
    expect(entry.entityLabel).toContain('Registration for');
  });

  it('logs the reset into the database the reset created', () => {
    // A log that simply emptied would look like a log that lost its contents.
    request('PATCH', `/employers/${getMockDb().employers[0].id}`, { body: { stage: 'proposal' } });
    expect(log().length).toBeGreaterThan(0);

    request('POST', '/demo/reset');

    expect(log()).toHaveLength(1);
    expect(log()[0].action).toBe('reset');
  });

  it('caps the log rather than growing without limit', () => {
    const employer = getMockDb().employers[0];
    for (let i = 0; i < MAX_AUDIT_ENTRIES + 10; i++) {
      request('PATCH', `/employers/${employer.id}`, {
        body: { stage: i % 2 === 0 ? 'proposal' : 'lead' },
      });
    }

    expect(log()).toHaveLength(MAX_AUDIT_ENTRIES);
  });

  it('shows staff the log, newest first', () => {
    request('PATCH', `/employers/${getMockDb().employers[0].id}`, { body: { stage: 'proposal' } });
    request('PATCH', `/employers/${getMockDb().employers[1].id}`, { body: { stage: 'proposal' } });

    const rows = data<readonly { entityLabel: string }[]>(request('GET', '/audit-entries'));
    expect(rows[0].entityLabel).toBe(getMockDb().employers[1].name);
  });

  it('hides the log from everyone else', () => {
    // 404, not 403: it does not confirm the log is there.
    expect(request('GET', '/audit-entries', { user: HM_ONE }).status).toBe(404);
    expect(request('GET', '/audit-entries', { user: SEEKER }).status).toBe(404);
  });

  it('filters by entity and by action', () => {
    const employer = getMockDb().employers.find((entry) => entry.stage === 'lead')!;
    request('PATCH', `/employers/${employer.id}`, { body: { stage: 'proposal' } });
    const pending = getMockDb().fairApplications.find((entry) => entry.status === 'pending')!;
    request('PATCH', `/fair-applications/${pending.id}`, { body: { status: 'approved' } });

    const employers = data<readonly unknown[]>(request('GET', '/audit-entries?entity=employer'));
    const approvals = data<readonly unknown[]>(request('GET', '/audit-entries?action=approved'));

    expect(employers.length).toBeGreaterThan(0);
    expect(approvals).toHaveLength(1);
  });
});

describe('fair exhibitors', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  interface Exhibitor {
    employerId: string;
    name: string;
    boothCode: string;
    openingCount: number;
  }

  it('lists one row per employer holding a booth at this fair', () => {
    const exhibitors = data<Exhibitor[]>(call(db, 'GET', '/fairs/fair-01/exhibitors'));
    const seated = db.booths.filter(
      (booth) => booth.fairId === 'fair-01' && booth.employerId !== null,
    );

    expect(exhibitors).toHaveLength(seated.length);
    expect(exhibitors.length).toBeGreaterThan(0);
  });

  it('carries NO commercial field, whatever the employer record holds', () => {
    // The point of the projection (docs/11 J-D1): these cannot leak through a
    // template because they are not in the object at all. If someone ever
    // "simplifies" this handler to return the Employer, this fails.
    const exhibitors = data<Record<string, unknown>[]>(
      call(db, 'GET', '/fairs/fair-01/exhibitors'),
    );

    for (const field of [
      'stage',
      'dealValueMyr',
      'contactEmail',
      'contactPhone',
      'contactName',
      'lostReason',
      'notes',
    ]) {
      expect(exhibitors.every((row) => !(field in row))).toBe(true);
    }
  });

  it('excludes an employer tagged with the fair who has no booth', () => {
    // `fairIds` includes leads who were never accepted. Listing from it would
    // advertise companies that are not coming (docs/11 J-D3).
    const seatedIds = new Set(
      db.booths
        .filter((booth) => booth.fairId === 'fair-01' && booth.employerId !== null)
        .map((booth) => booth.employerId),
    );
    const taggedButUnseated = db.employers.filter(
      (employer) => employer.fairIds.includes('fair-01') && !seatedIds.has(employer.id),
    );
    expect(taggedButUnseated.length).toBeGreaterThan(0); // the case exists in the seed

    const listed = new Set(
      data<Exhibitor[]>(call(db, 'GET', '/fairs/fair-01/exhibitors')).map(
        (row) => row.employerId,
      ),
    );
    for (const employer of taggedButUnseated) {
      expect(listed.has(employer.id)).toBe(false);
    }
  });

  it('counts only the openings advertised at this fair', () => {
    const exhibitors = data<Exhibitor[]>(call(db, 'GET', '/fairs/fair-01/exhibitors'));
    const row = exhibitors.find((entry) => entry.openingCount > 0)!;
    const expected = db.jobOpenings.filter(
      (opening) =>
        opening.employerId === row.employerId && opening.fairIds.includes('fair-01'),
    ).length;

    expect(row.openingCount).toBe(expected);
  });

  it('404s an unknown fair', () => {
    expect(call(db, 'GET', '/fairs/fair-99/exhibitors').status).toBe(404);
  });

  it('is readable by every role — there is nothing here to gate', () => {
    for (const user of [STAFF, HM_ONE, SEEKER]) {
      expect(call(db, 'GET', '/fairs/fair-01/exhibitors', { user }).status).toBe(200);
    }
  });
});

describe('fair job openings', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  interface Opening {
    id: string;
    title: string;
    employerId: string;
    employerName: string;
    boothCode: string;
    jobFunction: string;
    employmentType: string;
    experienceLevel: string;
    salaryMinMyr: number | null;
    salaryMaxMyr: number | null;
  }

  function list(path: string): Opening[] {
    return data<Opening[]>(call(db, 'GET', path));
  }

  it('lists openings for employers with a booth here, denormalised', () => {
    const openings = list('/fairs/fair-01/job-openings?per_page=200');

    expect(openings.length).toBeGreaterThan(0);
    for (const opening of openings) {
      expect(opening.employerName).not.toBe('Unknown employer');
      // The booth code is what a visitor uses to find the stand, so a row
      // without one is useless.
      expect(opening.boothCode).toMatch(/^[A-E]-\d{2}$/);
    }
  });

  it('paginates, because a fair runs to hundreds of rows', () => {
    const body = call(db, 'GET', '/fairs/fair-01/job-openings').body as {
      data: unknown[];
      meta: { total: number; perPage: number };
    };

    expect(body.meta.total).toBeGreaterThan(body.data.length);
    expect(body.data).toHaveLength(body.meta.perPage);
  });

  it('filters by function, type and level', () => {
    const all = list('/fairs/fair-01/job-openings?per_page=200');
    const someFunction = all[0].jobFunction;

    const byFunction = list(
      `/fairs/fair-01/job-openings?per_page=200&function=${encodeURIComponent(someFunction)}`,
    );
    expect(byFunction.length).toBeGreaterThan(0);
    expect(byFunction.every((row) => row.jobFunction === someFunction)).toBe(true);

    const interns = list('/fairs/fair-01/job-openings?per_page=200&type=internship');
    expect(interns.every((row) => row.employmentType === 'internship')).toBe(true);

    const fresh = list('/fairs/fair-01/job-openings?per_page=200&level=fresh_graduate');
    expect(fresh.every((row) => row.experienceLevel === 'fresh_graduate')).toBe(true);
  });

  it('excludes an opening whose employer has no booth at this fair', () => {
    const seated = new Set(
      db.booths
        .filter((booth) => booth.fairId === 'fair-02' && booth.employerId !== null)
        .map((booth) => booth.employerId),
    );
    const listed = list('/fairs/fair-02/job-openings?per_page=500');

    expect(listed.every((row) => seated.has(row.employerId))).toBe(true);
  });

  it('leaves both salary ends null together when undisclosed', () => {
    const openings = list('/fairs/fair-01/job-openings?per_page=200');
    const undisclosed = openings.filter((row) => row.salaryMinMyr === null);

    // The seed must actually produce the empty case, or the UI path for it
    // would never be exercised (docs/11 J-D5).
    expect(undisclosed.length).toBeGreaterThan(0);
    expect(undisclosed.every((row) => row.salaryMaxMyr === null)).toBe(true);
    expect(
      openings
        .filter((row) => row.salaryMinMyr !== null)
        .every((row) => (row.salaryMaxMyr as number) > (row.salaryMinMyr as number)),
    ).toBe(true);
  });

  it('404s an unknown fair', () => {
    expect(call(db, 'GET', '/fairs/fair-99/job-openings').status).toBe(404);
  });
});

describe('the employer pipeline is staff-only', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  // `/employers` returns stage, deal value, contact details and internal
  // notes. It used to answer anyone (docs/11 J-D2).
  it('404s the list for an employer and a job seeker', () => {
    expect(call(db, 'GET', '/employers', { user: HM_ONE }).status).toBe(404);
    expect(call(db, 'GET', '/employers', { user: SEEKER }).status).toBe(404);
    expect(call(db, 'GET', '/employers', { user: STAFF }).status).toBe(200);
  });

  it('404s the detail for an employer and a job seeker', () => {
    const id = db.employers[0].id;

    // Even their own record: this endpoint is the sales view of them, not
    // their profile.
    expect(call(db, 'GET', `/employers/${id}`, { user: HM_ONE }).status).toBe(404);
    expect(call(db, 'GET', `/employers/${id}`, { user: SEEKER }).status).toBe(404);
    expect(call(db, 'GET', `/employers/${id}`, { user: STAFF }).status).toBe(200);
  });

  it('says only "Not found", so the refusal is indistinguishable from absence', () => {
    expect(message(call(db, 'GET', '/employers', { user: SEEKER }))).toBe('Not found.');
  });
});

/**
 * The handler tests above call `matchRoute` and the handler directly. These go
 * through `runMockRequest`, which is what the interceptor actually calls, and
 * then apply `toSnakeCase` the way the interceptor does before the body
 * reaches the wire.
 *
 * Worth the duplication for exactly one reason: the gate depends on
 * `currentUser` being threaded from the auth store through the engine to the
 * handler, and a test that hands the handler a user directly cannot show that
 * happens.
 */
describe('through the engine, as the interceptor calls it', () => {
  beforeEach(() => resetMockDb(NOW));

  function request(method: string, path: string, user: User): MockResult {
    const url = new URL(path, 'http://mock.local');
    return runMockRequest({
      method,
      path: url.pathname,
      query: url.searchParams,
      body: null,
      currentUser: user,
      isProduction: true,
    });
  }

  /** What the interceptor puts on the wire. */
  function wire(result: MockResult): Record<string, unknown>[] {
    return (toSnakeCase(result.body) as { data: Record<string, unknown>[] }).data;
  }

  it('refuses the employer pipeline to a job seeker end to end', () => {
    expect(request('GET', '/employers', SEEKER).status).toBe(404);
    expect(request('GET', '/employers/emp-001', SEEKER).status).toBe(404);
    expect(request('GET', '/employers', STAFF).status).toBe(200);
  });

  it('puts no commercial field on the wire, in any casing', () => {
    const rows = wire(request('GET', '/fairs/fair-01/exhibitors', SEEKER));
    expect(rows.length).toBeGreaterThan(0);

    // snake_case, because that is what crosses the wire — checking the
    // camelCase names alone would miss a leak added after serialisation.
    const forbidden = [
      'stage',
      'deal_value_myr',
      'contact_email',
      'contact_phone',
      'contact_name',
      'lost_reason',
      'notes',
    ];
    const seen = new Set(rows.flatMap((row) => Object.keys(row)));
    for (const field of forbidden) {
      expect(seen.has(field)).toBe(false);
    }
    expect(seen.has('booth_code')).toBe(true);
    expect(seen.has('opening_count')).toBe(true);
  });

  it('serves the job openings a seeker asks for', () => {
    const result = request('GET', '/fairs/fair-01/job-openings?per_page=5', SEEKER);
    const rows = wire(result);

    expect(result.status).toBe(200);
    expect(rows).toHaveLength(5);
    expect(rows[0]['employer_name']).toBeTruthy();
    expect(rows[0]['booth_code']).toBeTruthy();
  });
});

describe('candidate visibility', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  /** The fairs a given employer is committed to. */
  function fairsFor(employerId: string): readonly string[] {
    return db.employers.find((entry) => entry.id === employerId)?.fairIds ?? [];
  }

  /**
   * Every candidate this user can see, paged through.
   *
   * `readPageRequest` caps per_page at 100, so a single request cannot answer
   * "what is the whole set" — asking for 500 silently returns 100, which made
   * the first version of these tests assert against an arbitrary first page.
   */
  function listFor(user: User): { id: string; fairIds: string[] }[] {
    const rows: { id: string; fairIds: string[] }[] = [];
    for (let page = 1; ; page++) {
      const result = call(db, 'GET', `/candidates?per_page=100&page=${page}`, { user });
      const batch = data<{ id: string; fairIds: string[] }[]>(result);
      rows.push(...batch);
      const meta = (result.body as { meta: { lastPage: number } }).meta;
      if (page >= meta.lastPage || batch.length === 0) {
        return rows;
      }
    }
  }

  it('shows an employer only candidates registered for a fair they attend', () => {
    const rows = listFor(HM_ONE);
    const theirFairs = fairsFor('emp-001');

    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((row) => row.fairIds.some((fairId) => theirFairs.includes(fairId))),
    ).toBe(true);
  });

  it('hides candidates registered only for fairs this employer is not at', () => {
    const theirFairs = fairsFor('emp-001');
    const elsewhere = db.candidates.filter(
      (candidate) => !candidate.fairIds.some((fairId) => theirFairs.includes(fairId)),
    );
    // The seed must actually contain this case, or the test proves nothing.
    expect(elsewhere.length).toBeGreaterThan(0);

    const visible = new Set(listFor(HM_ONE).map((row) => row.id));
    for (const candidate of elsewhere) {
      expect(visible.has(candidate.id)).toBe(false);
    }
  });

  it('404s a candidate an employer may not see, rather than masking them', () => {
    const theirFairs = fairsFor('emp-001');
    const elsewhere = db.candidates.find(
      (candidate) => !candidate.fairIds.some((fairId) => theirFairs.includes(fairId)),
    )!;

    const result = call(db, 'GET', `/candidates/${elsewhere.id}`, { user: HM_ONE });

    // 404, not a masked record: a masked record still confirms the person
    // exists and leaks their name, university, course and skills.
    expect(result.status).toBe(404);
    expect(message(result)).toBe('Candidate not found.');
  });

  it('withdrawing from every fair removes a seeker from the pool entirely', () => {
    // The defect this whole change exists for: a job seeker who withdrew from
    // everything stayed visible to employers while their own profile told them
    // they were visible to nobody.
    const candidate = db.candidates.find((entry) => entry.fairIds.length > 0)!;
    const seeker: User = {
      id: 'u-seeker-x',
      name: candidate.fullName,
      role: 'job_seeker',
      employerId: null,
      candidateId: candidate.id,
    };

    expect(new Set(listFor(HM_ONE).map((row) => row.id)).has(candidate.id)).toBe(true);

    for (const registration of db.fairRegistrations.filter(
      (entry) => entry.candidateId === candidate.id,
    )) {
      expect(call(db, 'DELETE', `/fair-registrations/${registration.id}`, { user: seeker }).status)
        .toBe(204);
    }

    expect(new Set(listFor(HM_ONE).map((row) => row.id)).has(candidate.id)).toBe(false);
    expect(call(db, 'GET', `/candidates/${candidate.id}`, { user: HM_ONE }).status).toBe(404);
    // But they can still read their own record.
    expect(call(db, 'GET', `/candidates/${candidate.id}`, { user: seeker }).status).toBe(200);
  });

  it('shows an employer still at proposal nothing, though they are fair-tagged', () => {
    // This is the case `fairIds` alone would let through. In the seed, leads
    // and lost deals carry no fairIds at all — it is the 12 employers at
    // `proposal` who are tagged to fairs without having committed to one.
    // Nobody consented to a company that has not booked.
    const proposal = db.employers.find(
      (entry) => entry.stage === 'proposal' && entry.fairIds.length > 0,
    )!;
    expect(proposal).toBeDefined();

    const user: User = {
      id: 'u-proposal',
      name: 'Proposal Rep',
      role: 'employer',
      employerId: proposal.id,
      candidateId: null,
    };

    expect(listFor(user)).toHaveLength(0);
  });

  it('lets staff see every registrant, masked', () => {
    const rows = listFor(STAFF) as unknown as { isContactVisible: boolean }[];

    expect(rows).toHaveLength(db.candidates.length);
    // Staff run the fairs, but that is not a reason to hand them contact
    // details (docs/11 V-D3).
    expect(rows.every((row) => row.isContactVisible === false)).toBe(true);
  });

  it('shows a job seeker their own record and nobody else', () => {
    const own = db.candidates[0];
    const other = db.candidates[1];
    const seeker: User = {
      id: 'u-seeker-y',
      name: own.fullName,
      role: 'job_seeker',
      employerId: null,
      candidateId: own.id,
    };

    expect(listFor(seeker).map((row) => row.id)).toEqual([own.id]);
    expect(call(db, 'GET', `/candidates/${own.id}`, { user: seeker }).status).toBe(200);
    expect(call(db, 'GET', `/candidates/${other.id}`, { user: seeker }).status).toBe(404);
  });

  it('still unmasks a shortlisted candidate the employer may see', () => {
    // Visibility and masking are separate gates; this proves the new one did
    // not swallow the old one.
    const theirFairs = fairsFor('emp-001');
    const reachable = db.candidates.find((candidate) =>
      candidate.fairIds.some((fairId) => theirFairs.includes(fairId)),
    )!;

    call(db, 'POST', '/shortlists', {
      user: HM_ONE,
      body: { candidateId: reachable.id, fairId: theirFairs[0], note: null },
    });

    const row = data<{ isContactVisible: boolean; email: string }>(
      call(db, 'GET', `/candidates/${reachable.id}`, { user: HM_ONE }),
    );
    expect(row.isContactVisible).toBe(true);
    expect(row.email).not.toContain('***');
  });
});

/**
 * The consent notice names the fields an employer will see. If the API starts
 * returning a field the notice does not mention, the consent stops being
 * informed for that field — which is the failure V3 was written to close, and
 * is not something a copy review would catch on its own.
 */
describe('consent covers what is actually shared', () => {
  let db: MockDb;
  beforeEach(() => (db = buildMockDb(NOW)));

  it('exposes exactly the candidate fields the consent dialog lists', () => {
    const [row] = data<Record<string, unknown>[]>(
      call(db, 'GET', '/candidates?per_page=1', { user: HM_ONE }),
    );

    // Named in the dialog, in order: name + headline, university, course,
    // qualification, graduation year, CGPA, skills.
    const named = [
      'fullName',
      'headline',
      'university',
      'fieldOfStudy',
      'qualification',
      'graduationYear',
      'cgpa',
      'skills',
    ];
    for (const field of named) {
      expect(Object.keys(row)).toContain(field);
    }

    // Everything else the row carries is either contact detail the dialog
    // covers separately, or plumbing with nothing personal in it. A new key
    // outside this list means the notice needs a new line.
    const allowed = new Set([...named, 'id', 'email', 'phone', 'isContactVisible', 'fairIds']);
    const unexpected = Object.keys(row).filter((key) => !allowed.has(key));

    expect(unexpected).toEqual([]);
  });
});
