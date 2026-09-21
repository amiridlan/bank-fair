import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EmployersStore } from './employers.store';

function row(id: string, stage: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Employer ${id}`,
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
    ...overrides,
  };
}

describe('EmployersStore', () => {
  let store: EmployersStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(EmployersStore);
    http = TestBed.inject(HttpTestingController);

    const loading = store.load();
    http.expectOne((r) => r.url === '/employers').flush({
      data: [row('emp-001', 'lead'), row('emp-002', 'proposal'), row('emp-003', 'paid')],
    });
    await loading;
    store.setSearch('');
  });

  afterEach(() => http.verify());

  it('groups employers into every pipeline column', () => {
    const board = store.byStage();

    expect(board.lead.map((e) => e.id)).toEqual(['emp-001']);
    expect(board.proposal.map((e) => e.id)).toEqual(['emp-002']);
    expect(board.paid.map((e) => e.id)).toEqual(['emp-003']);
    // A column with nobody in it still exists, so the board renders it empty.
    expect(board.confirmed).toEqual([]);
    expect(board.lost).toEqual([]);
  });

  it('filters the board by search term without refetching', () => {
    store.setSearch('emp-002');

    expect(store.byStage().lead).toEqual([]);
    expect(store.byStage().proposal.map((e) => e.id)).toEqual(['emp-002']);
  });

  it('excludes lost deals from the total value', async () => {
    const before = store.totalValueMyr();

    const move = store.moveStage({ employerId: 'emp-003', stage: 'lost', lostReason: 'Budget.' });
    http
      .expectOne('/employers/emp-003')
      .flush({ data: row('emp-003', 'lost', { lost_reason: 'Budget.', deal_value_myr: null }) });
    await move;

    expect(store.totalValueMyr()).toBe(before - 7500);
  });

  describe('optimistic stage move', () => {
    it('moves the card before the server answers', () => {
      void store.moveStage({ employerId: 'emp-001', stage: 'proposal' });

      // Not awaited: this is the state the user sees while in flight.
      expect(store.byStage().proposal.map((e) => e.id)).toContain('emp-001');
      expect(store.byStage().lead).toEqual([]);
      expect(store.pendingId()).toBe('emp-001');

      http.expectOne('/employers/emp-001').flush({ data: row('emp-001', 'proposal') });
    });

    it('replaces the optimistic guess with the server version', async () => {
      const move = store.moveStage({ employerId: 'emp-001', stage: 'confirmed' });
      http
        .expectOne('/employers/emp-001')
        .flush({ data: row('emp-001', 'confirmed', { deal_value_myr: 12_000 }) });
      const error = await move;

      expect(error).toBeNull();
      // The optimistic update could not know the recomputed deal value.
      expect(store.employers().find((e) => e.id === 'emp-001')?.dealValueMyr).toBe(12_000);
      expect(store.pendingId()).toBeNull();
    });

    it('rolls back to the original column when the request fails', async () => {
      const move = store.moveStage({ employerId: 'emp-001', stage: 'paid' });
      expect(store.byStage().paid.map((e) => e.id)).toContain('emp-001');

      http
        .expectOne('/employers/emp-001')
        .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
      const error = await move;

      expect(error?.status).toBe(500);
      expect(store.byStage().lead.map((e) => e.id)).toEqual(['emp-001']);
      expect(store.byStage().paid.map((e) => e.id)).toEqual(['emp-003']);
      expect(store.pendingId()).toBeNull();
    });

    it('rolls back a 422 and surfaces the field errors', async () => {
      const move = store.moveStage({ employerId: 'emp-001', stage: 'paid' });
      http.expectOne('/employers/emp-001').flush(
        {
          message: 'A booth package is required before an employer can be marked paid.',
          errors: { booth_package: ['A booth package is required.'] },
        },
        { status: 422, statusText: 'Unprocessable' },
      );
      const error = await move;

      expect(error?.status).toBe(422);
      expect(error?.fieldErrors['boothPackage']).toBeDefined();
      expect(store.byStage().lead.map((e) => e.id)).toEqual(['emp-001']);
    });

    it('restores every card, not just the moved one, on failure', async () => {
      const before = store.employers();

      const move = store.moveStage({ employerId: 'emp-002', stage: 'lost', lostReason: 'No.' });
      http.expectOne('/employers/emp-002').flush({}, { status: 500, statusText: 'Error' });
      await move;

      expect(store.employers()).toEqual(before);
    });

    it('does nothing when the stage is unchanged', async () => {
      const error = await store.moveStage({ employerId: 'emp-001', stage: 'lead' });

      expect(error).toBeNull();
      // No request is made, which http.verify() in afterEach confirms.
    });

    it('ignores an unknown employer', async () => {
      expect(await store.moveStage({ employerId: 'nope', stage: 'paid' })).toBeNull();
    });
  });

  describe('create and update', () => {
    const input = {
      name: 'New Sdn Bhd',
      industry: 'Technology',
      companySize: '51-200' as const,
      contactName: 'Aisyah Rahman',
      contactEmail: 'aisyah@example.com',
      contactPhone: null,
      boothPackage: null,
      notes: null,
    };

    it('prepends a created employer to the board', async () => {
      const creating = store.create(input);
      const req = http.expectOne('/employers');

      expect(req.request.body).toMatchObject({ contact_email: 'aisyah@example.com' });
      req.flush({ data: row('emp-999', 'lead', { name: 'New Sdn Bhd' }) }, { status: 201, statusText: 'Created' });
      const error = await creating;

      expect(error).toBeNull();
      expect(store.byStage().lead.map((e) => e.id)).toContain('emp-999');
    });

    it('returns a 422 without adding anything to the board', async () => {
      const before = store.employers().length;

      const creating = store.create(input);
      http.expectOne('/employers').flush(
        { message: 'Invalid.', errors: { contact_email: ['Taken.'] } },
        { status: 422, statusText: 'Unprocessable' },
      );
      const error = await creating;

      expect(error?.fieldErrors['contactEmail']).toEqual(['Taken.']);
      expect(store.employers()).toHaveLength(before);
    });

    it('replaces an updated employer in place', async () => {
      const updating = store.update('emp-002', { name: 'Renamed Bhd' });
      http.expectOne('/employers/emp-002').flush({ data: row('emp-002', 'proposal', { name: 'Renamed Bhd' }) });
      await updating;

      expect(store.employers().find((e) => e.id === 'emp-002')?.name).toBe('Renamed Bhd');
      expect(store.employers()).toHaveLength(3);
    });
  });

  describe('valueByStage', () => {
    it('totals each column, and reports zero for an empty one', () => {
      const totals = store.valueByStage();

      // Every seeded row carries 7500, one per stage.
      expect(totals.lead).toBe(7500);
      expect(totals.proposal).toBe(7500);
      expect(totals.paid).toBe(7500);
      expect(totals.confirmed).toBe(0);
      expect(totals.lost).toBe(0);
    });

    it('follows the search, so the header total matches the cards under it', () => {
      store.setSearch('emp-001');

      const totals = store.valueByStage();

      expect(totals.lead).toBe(7500);
      expect(totals.proposal).toBe(0);
      expect(totals.paid).toBe(0);
    });

    it('counts an employer with no deal value as zero rather than skipping it', async () => {
      // A lead has no proposal yet, so dealValueMyr is null.
      const loading = store.load();
      http
        .expectOne((r) => r.url === '/employers')
        .flush({ data: [row('emp-009', 'lead', { deal_value_myr: null })] });
      await loading;

      expect(store.valueByStage().lead).toBe(0);
      expect(store.byStage().lead).toHaveLength(1);
    });
  });
});
