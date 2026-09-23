import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SeekerFairDetailStore } from './seeker-fair-detail.store';

const FAIR = {
  id: 'fair-01',
  name: 'KL Career Discovery Fair',
  venue: 'Sunway Pyramid',
  city: 'Petaling Jaya',
  description: 'Two days across three halls.',
  start_date: '2026-09-23T09:00:00+08:00',
  end_date: '2026-09-24T18:00:00+08:00',
  status: 'live',
  booth_total: 40,
  booth_assigned: 26,
  registrations: 2840,
  check_ins: 1612,
};

function exhibitor(id: string, openingCount: number) {
  return {
    employer_id: id,
    name: `Employer ${id}`,
    industry: 'Technology',
    company_size: '51-200',
    booth_code: 'A-01',
    opening_count: openingCount,
  };
}

describe('SeekerFairDetailStore', () => {
  let http: HttpTestingController;
  let store: SeekerFairDetailStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SeekerFairDetailStore);
  });

  afterEach(() => http.verify());

  async function load(exhibitors: readonly ReturnType<typeof exhibitor>[] = []) {
    const done = store.load('fair-01');
    http.expectOne('/fairs/fair-01').flush({ data: FAIR });
    http.expectOne('/fairs/fair-01/exhibitors').flush({ data: exhibitors });
    await done;
  }

  it('totals the roles across every stand', async () => {
    await load([exhibitor('emp-001', 3), exhibitor('emp-002', 5), exhibitor('emp-003', 0)]);

    expect(store.exhibitorCount()).toBe(3);
    expect(store.openingCount()).toBe(8);
  });

  it('records which fair the contents belong to', async () => {
    await load([exhibitor('emp-001', 1)]);

    expect(store.loadedId()).toBe('fair-01');
  });

  it('clears everything on failure, so no stale fair is left showing', async () => {
    await load([exhibitor('emp-001', 1)]);

    const done = store.load('fair-99');
    http.expectOne('/fairs/fair-99').flush({ message: 'Fair not found.' }, { status: 404, statusText: 'Not Found' });
    http.expectOne('/fairs/fair-99/exhibitors').flush({ data: [] });
    await done;

    expect(store.hasError()).toBe(true);
    expect(store.fair()).toBeNull();
    expect(store.exhibitors()).toEqual([]);
    // Null rather than 'fair-01': the shell uses this to tell whether what it
    // holds matches the URL, and leaving the old id would say yes wrongly.
    expect(store.loadedId()).toBeNull();
  });

  it('reads the exhibitor list, never the employer pipeline', async () => {
    const done = store.load('fair-01');
    http.expectOne('/fairs/fair-01').flush({ data: FAIR });
    http.expectOne('/fairs/fair-01/exhibitors').flush({ data: [] });
    await done;

    // `/employers` is staff-only and carries deal values and contact details.
    // A seeker surface must never reach for it (docs/11 J-D1, J-D2).
    http.expectNone('/employers');
  });
});
