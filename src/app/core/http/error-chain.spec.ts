import { TestBed } from '@angular/core/testing';

import { appConfig } from '../../app.config';
import { AuthStore } from '../auth/auth.store';
import { FloorPlanStore } from '../../features/fairs/floor-plan.store';
import { ShortlistStore } from '../../features/shortlist/shortlist.store';

/**
 * Error handling through the REAL interceptor chain.
 *
 * Every other store spec uses `HttpTestingController`, which replaces the
 * backend but also bypasses the interceptors. That is the right tool for
 * testing a store's logic, and it is precisely why a whole class of bug went
 * unnoticed: `errorInterceptor` converts failures to `ApiError` and rethrows,
 * so in the running app a store's catch block receives an `ApiError` rather
 * than an `HttpErrorResponse`. `toApiError` did not recognise its own output,
 * so every status collapsed to 0 and no 409 was ever seen as a conflict.
 *
 * These tests use `appConfig.providers` — the real chain, against the mock API
 * — so the status a store actually observes is what is asserted.
 */
describe('error handling through the real interceptor chain', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
  });

  it('surfaces a 409 from an occupied booth as a conflict, not a generic failure', async () => {
    const store = TestBed.inject(FloorPlanStore);
    await store.load('fair-01');

    const occupied = store.booths().find((booth) => booth.employerId !== null);
    const free = store.booths().find((booth) => booth.employerId === null);
    expect(occupied).toBeDefined();
    expect(free).toBeDefined();

    // Someone who does not already hold this booth.
    const other = store.unassignedEmployers()[0];
    expect(other).toBeDefined();

    const result = await store.assign(occupied!.id, other.id);

    expect(result.conflict).toBe(true);
    expect(result.error?.status).toBe(409);
    // The grid must be back where it started, not showing a rejected move.
    expect(store.boothById(occupied!.id)?.employerId).toBe(occupied!.employerId);
  });

  it('lets force through, so the replace-confirm path can complete', async () => {
    const store = TestBed.inject(FloorPlanStore);
    await store.load('fair-01');

    const occupied = store.booths().find((booth) => booth.employerId !== null)!;
    const other = store.unassignedEmployers()[0];

    const result = await store.assign(occupied.id, other.id, true);

    expect(result.conflict).toBe(false);
    expect(result.error).toBeNull();
    expect(store.boothById(occupied.id)?.employerId).toBe(other.id);
  });

  it('surfaces a duplicate shortlist as a 409 rather than an error state', async () => {
    // Shortlists are scoped to the acting employer, and the seeded ones belong
    // to the first hiring manager. As staff the list comes back empty.
    TestBed.inject(AuthStore).switchUser('u-emp-1');
    const store = TestBed.inject(ShortlistStore);
    await store.load('fair-01');

    const existing = store.entries()[0];
    expect(existing).toBeDefined();

    const again = await store.add(existing.candidateId, 'fair-01', null);

    expect(again.duplicate).toBe(true);
    expect(again.error?.status).toBe(409);
  });
});
