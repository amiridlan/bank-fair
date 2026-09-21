import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FloorPlanStore } from './floor-plan.store';

function booth(code: string, row: number, col: number, employer: [string, string] | null) {
  return {
    id: `booth-${code}`,
    fair_id: 'fair-01',
    code,
    row,
    col,
    package: row === 1 ? 'platinum' : 'standard',
    price_myr: row === 1 ? 12_000 : 3_500,
    employer_id: employer?.[0] ?? null,
    employer_name: employer?.[1] ?? null,
  };
}

function employer(id: string, name: string, stage = 'confirmed') {
  return {
    id,
    name,
    industry: 'Technology',
    company_size: '51-200',
    stage,
    lost_reason: null,
    contact_name: 'Aisyah Rahman',
    contact_email: `${id}@example.com`,
    contact_phone: null,
    booth_package: 'premium',
    deal_value_myr: 7500,
    fair_ids: ['fair-01'],
    notes: null,
    created_at: '2026-06-01T10:00:00+08:00',
    updated_at: '2026-06-01T10:00:00+08:00',
  };
}

const BOOTHS = [
  booth('A-01', 1, 1, ['emp-001', 'Alpha Bhd']),
  booth('A-02', 1, 2, null),
  booth('B-01', 2, 1, null),
];

const EMPLOYERS = [
  employer('emp-001', 'Alpha Bhd'),
  employer('emp-002', 'Beta Sdn Bhd'),
  employer('emp-003', 'Gamma Bhd', 'lead'),
  employer('emp-004', 'Delta Bhd', 'paid'),
];

describe('FloorPlanStore', () => {
  let store: FloorPlanStore;
  let http: HttpTestingController;

  async function loadFixture(): Promise<void> {
    const loading = store.load('fair-01');
    http.expectOne('/fairs/fair-01/booths').flush({ data: BOOTHS });
    http.expectOne((r) => r.url === '/employers').flush({ data: EMPLOYERS });
    await loading;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(FloorPlanStore);
    http = TestBed.inject(HttpTestingController);
    await loadFixture();
  });

  afterEach(() => http.verify());

  it('groups booths into rows in grid order', () => {
    const rows = store.rows();

    expect(rows).toHaveLength(2);
    expect(rows[0].map((b) => b.code)).toEqual(['A-01', 'A-02']);
    expect(rows[1].map((b) => b.code)).toEqual(['B-01']);
  });

  it('lists only committed employers without a booth', () => {
    // emp-001 already holds A-01; emp-003 is a lead, so neither is draggable.
    expect(store.unassignedEmployers().map((e) => e.id)).toEqual(['emp-004', 'emp-002'].sort());
  });

  it('counts assigned booths', () => {
    expect(store.assignedCount()).toBe(1);
  });

  describe('optimistic assignment', () => {
    it('fills the booth before the server answers', () => {
      void store.assign('booth-A-02', 'emp-002');

      expect(store.boothById('booth-A-02')?.employerName).toBe('Beta Sdn Bhd');
      expect(store.pendingBoothId()).toBe('booth-A-02');

      http
        .expectOne('/booths/booth-A-02')
        .flush({ data: booth('A-02', 1, 2, ['emp-002', 'Beta Sdn Bhd']) });
    });

    it('removes the employer from the unassigned list immediately', () => {
      void store.assign('booth-A-02', 'emp-002');

      expect(store.unassignedEmployers().map((e) => e.id)).not.toContain('emp-002');

      http
        .expectOne('/booths/booth-A-02')
        .flush({ data: booth('A-02', 1, 2, ['emp-002', 'Beta Sdn Bhd']) });
    });

    it('clears an employer previous booth, matching the API rule', () => {
      void store.assign('booth-B-01', 'emp-001');

      // emp-001 held A-01; one booth per employer per fair.
      expect(store.boothById('booth-A-01')?.employerId).toBeNull();
      expect(store.boothById('booth-B-01')?.employerId).toBe('emp-001');

      http
        .expectOne('/booths/booth-B-01')
        .flush({ data: booth('B-01', 2, 1, ['emp-001', 'Alpha Bhd']) });
    });

    it('rolls the whole grid back when the request fails', async () => {
      const before = store.booths();

      const assigning = store.assign('booth-A-02', 'emp-002');
      expect(store.boothById('booth-A-02')?.employerId).toBe('emp-002');

      http
        .expectOne('/booths/booth-A-02')
        .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
      const result = await assigning;

      expect(result.error?.status).toBe(500);
      expect(result.conflict).toBe(false);
      expect(store.booths()).toEqual(before);
      expect(store.pendingBoothId()).toBeNull();
    });

    it('reports a 409 as a conflict, not a plain failure', async () => {
      const assigning = store.assign('booth-A-01', 'emp-002');
      http
        .expectOne('/booths/booth-A-01')
        .flush({ message: 'Alpha Bhd already has booth A-01.' }, { status: 409, statusText: 'Conflict' });
      const result = await assigning;

      expect(result.conflict).toBe(true);
      // Rolled back, so the UI can ask before replacing.
      expect(store.boothById('booth-A-01')?.employerId).toBe('emp-001');
    });

    it('sends force when replacing a confirmed occupant', async () => {
      const assigning = store.assign('booth-A-01', 'emp-002', true);
      const req = http.expectOne('/booths/booth-A-01');

      expect(req.request.body).toEqual({ employer_id: 'emp-002', force: true });
      req.flush({ data: booth('A-01', 1, 1, ['emp-002', 'Beta Sdn Bhd']) });
      await assigning;

      expect(store.boothById('booth-A-01')?.employerName).toBe('Beta Sdn Bhd');
    });

    it('returns the previous occupant so Undo can restore it', async () => {
      const assigning = store.assign('booth-A-01', 'emp-002', true);
      http
        .expectOne('/booths/booth-A-01')
        .flush({ data: booth('A-01', 1, 1, ['emp-002', 'Beta Sdn Bhd']) });
      const result = await assigning;

      expect(result.previousEmployerId).toBe('emp-001');
    });

    it('reports null as the previous occupant for an empty booth', async () => {
      const assigning = store.assign('booth-A-02', 'emp-002');
      http
        .expectOne('/booths/booth-A-02')
        .flush({ data: booth('A-02', 1, 2, ['emp-002', 'Beta Sdn Bhd']) });
      const result = await assigning;

      // Undo on a previously empty booth clears it again.
      expect(result.previousEmployerId).toBeNull();
    });

    it('clears a booth when the employer is null', async () => {
      const assigning = store.assign('booth-A-01', null);
      expect(store.boothById('booth-A-01')?.employerId).toBeNull();

      http.expectOne('/booths/booth-A-01').flush({ data: booth('A-01', 1, 1, null) });
      await assigning;

      expect(store.assignedCount()).toBe(0);
      expect(store.unassignedEmployers().map((e) => e.id)).toContain('emp-001');
    });

    it('ignores an unknown booth', async () => {
      const result = await store.assign('booth-missing', 'emp-002');

      expect(result.error).toBeNull();
      expect(result.conflict).toBe(false);
    });
  });

  it('surfaces a load failure on the error signal', async () => {
    const loading = store.load('fair-99');
    http
      .expectOne('/fairs/fair-99/booths')
      .flush({ message: 'Fair not found.' }, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === '/employers').flush({ data: EMPLOYERS });
    await loading;

    expect(store.hasError()).toBe(true);
    expect(store.error()?.status).toBe(404);
  });
});
