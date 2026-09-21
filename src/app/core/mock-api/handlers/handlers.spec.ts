import type { User } from '../../models';
import { type MockDb, buildMockDb } from '../mock-db';
import type { MockContext, MockResult } from '../mock-response';
import { matchRoute } from './index';

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
    expect(data<unknown[]>(call(db, 'GET', '/fairs'))).toHaveLength(5);
  });

  it('filters by status and city', () => {
    expect(data<unknown[]>(call(db, 'GET', '/fairs?status=open'))).toHaveLength(2);
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
