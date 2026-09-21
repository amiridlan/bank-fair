import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FairsStore } from './fairs.store';

const FAIR_ROWS = [
  {
    id: 'fair-01',
    name: 'KL Career Discovery Fair',
    venue: 'Sunway',
    city: 'Petaling Jaya',
    start_date: '2026-09-21T09:00:00+08:00',
    end_date: '2026-09-22T18:00:00+08:00',
    status: 'live',
    booth_total: 40,
    booth_assigned: 26,
    registrations: 2840,
    check_ins: 1612,
  },
  {
    id: 'fair-02',
    name: 'National Career Fair',
    venue: 'MITEC',
    city: 'Kuala Lumpur',
    start_date: '2026-10-12T09:00:00+08:00',
    end_date: '2026-10-13T18:00:00+08:00',
    status: 'open',
    booth_total: 40,
    booth_assigned: 20,
    registrations: 1905,
    check_ins: 0,
  },
];

describe('FairsStore', () => {
  let store: FairsStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(FairsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts idle with nothing loaded', () => {
    expect(store.status()).toBe('idle');
    expect(store.fairs()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('moves through loading to success and camelCases the payload', async () => {
    const loading = store.load();
    expect(store.status()).toBe('loading');

    http.expectOne((r) => r.url === '/fairs').flush({ data: FAIR_ROWS });
    await loading;

    expect(store.status()).toBe('success');
    expect(store.fairs()).toHaveLength(2);
    expect(store.fairs()[0].boothAssigned).toBe(26);
    expect(store.hasError()).toBe(false);
  });

  it('sets an error signal rather than throwing', async () => {
    const loading = store.load();
    http
      .expectOne((r) => r.url === '/fairs')
      .flush({ message: 'Something went wrong on our side.' }, { status: 500, statusText: 'Error' });
    await loading;

    expect(store.status()).toBe('error');
    expect(store.error()?.status).toBe(500);
    expect(store.error()?.message).toBe('Something went wrong on our side.');
    expect(store.fairs()).toEqual([]);
  });

  it('clears a previous error on the next successful load', async () => {
    const failing = store.load();
    http.expectOne((r) => r.url === '/fairs').flush({}, { status: 500, statusText: 'Error' });
    await failing;
    expect(store.error()).not.toBeNull();

    const retry = store.load();
    http.expectOne((r) => r.url === '/fairs').flush({ data: FAIR_ROWS });
    await retry;

    expect(store.error()).toBeNull();
    expect(store.status()).toBe('success');
  });

  it('sends only the filters that are set', async () => {
    const loading = store.load({ status: 'open', city: null });
    const req = http.expectOne((r) => r.url === '/fairs');

    expect(req.request.params.get('status')).toBe('open');
    expect(req.request.params.has('city')).toBe(false);

    req.flush({ data: [FAIR_ROWS[1]] });
    await loading;

    expect(store.hasActiveFilters()).toBe(true);
  });

  it('reports empty separately from error', async () => {
    const loading = store.load({ status: 'draft', city: null });
    http.expectOne((r) => r.url === '/fairs').flush({ data: [] });
    await loading;

    expect(store.isEmpty()).toBe(true);
    expect(store.hasError()).toBe(false);
  });

  it('derives the distinct city list, sorted', async () => {
    const loading = store.load();
    http.expectOne((r) => r.url === '/fairs').flush({ data: FAIR_ROWS });
    await loading;

    expect(store.cities()).toEqual(['Kuala Lumpur', 'Petaling Jaya']);
  });

  it('prefers a live fair over an earlier open one', async () => {
    const loading = store.load();
    http.expectOne((r) => r.url === '/fairs').flush({ data: FAIR_ROWS });
    await loading;

    expect(store.nextActiveFair()?.id).toBe('fair-01');
  });

  it('has no next active fair when none are open or live', async () => {
    const loading = store.load();
    http
      .expectOne((r) => r.url === '/fairs')
      .flush({ data: [{ ...FAIR_ROWS[0], status: 'completed' }] });
    await loading;

    expect(store.nextActiveFair()).toBeNull();
  });

  it('loads a single fair', async () => {
    const loading = store.loadOne('fair-01');
    expect(store.selectedStatus()).toBe('loading');

    http.expectOne('/fairs/fair-01').flush({ data: FAIR_ROWS[0] });
    await loading;

    expect(store.selectedStatus()).toBe('success');
    expect(store.selected()?.name).toBe('KL Career Discovery Fair');
  });

  it('clears the selection on a 404 so a stale fair is never shown', async () => {
    const first = store.loadOne('fair-01');
    http.expectOne('/fairs/fair-01').flush({ data: FAIR_ROWS[0] });
    await first;

    const missing = store.loadOne('fair-99');
    http
      .expectOne('/fairs/fair-99')
      .flush({ message: 'Fair not found.' }, { status: 404, statusText: 'Not Found' });
    await missing;

    expect(store.selected()).toBeNull();
    expect(store.selectedError()?.status).toBe(404);
  });
});
