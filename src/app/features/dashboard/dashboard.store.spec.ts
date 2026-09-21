import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DashboardStore } from './dashboard.store';

const SUMMARY_ROW = {
  upcoming_fairs: { value: 3, delta_pct: null },
  booth_fill_rate: { value: 0.43, delta_pct: -0.27 },
  registrations: { value: 5487, delta_pct: 0.76 },
  pipeline_value_myr: { value: 214_500, delta_pct: null },
  booth_fill_by_fair: [
    { fair_id: 'fair-01', fair_name: 'KL Career Discovery Fair', booth_total: 40, booth_assigned: 26 },
  ],
  pipeline_by_stage: [
    { stage: 'lead', count: 15, value_myr: 0 },
    { stage: 'paid', count: 20, value_myr: 150_000 },
  ],
};

describe('DashboardStore', () => {
  let store: DashboardStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DashboardStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('camelCases the whole nested payload', async () => {
    const loading = store.load();
    http.expectOne('/dashboard/summary').flush({ data: SUMMARY_ROW });
    await loading;

    expect(store.status()).toBe('success');
    expect(store.summary()?.pipelineValueMyr.value).toBe(214_500);
    expect(store.summary()?.boothFillRate.deltaPct).toBe(-0.27);
    expect(store.boothFillByFair()[0].fairName).toBe('KL Career Discovery Fair');
    expect(store.pipelineByStage()[1].valueMyr).toBe(150_000);
  });

  it('exposes loading while the request is in flight', () => {
    void store.load();
    expect(store.isLoading()).toBe(true);

    http.expectOne('/dashboard/summary').flush({ data: SUMMARY_ROW });
  });

  it('sets an error signal instead of throwing', async () => {
    const loading = store.load();
    http
      .expectOne('/dashboard/summary')
      .flush({ message: 'Something went wrong on our side.' }, { status: 500, statusText: 'Error' });
    await loading;

    expect(store.hasError()).toBe(true);
    expect(store.error()?.message).toBe('Something went wrong on our side.');
  });

  it('falls back to empty chart data rather than null', async () => {
    const loading = store.load();
    http.expectOne('/dashboard/summary').flush({}, { status: 500, statusText: 'Error' });
    await loading;

    // Chart components take a required array; null would break them.
    expect(store.boothFillByFair()).toEqual([]);
    expect(store.pipelineByStage()).toEqual([]);
  });

  it('separates "no active fairs" from an error', async () => {
    const loading = store.load();
    http
      .expectOne('/dashboard/summary')
      .flush({ data: { ...SUMMARY_ROW, booth_fill_by_fair: [] } });
    await loading;

    expect(store.hasNoActiveFairs()).toBe(true);
    expect(store.hasError()).toBe(false);
  });

  it('does not report empty while still loading', () => {
    void store.load();
    expect(store.hasNoActiveFairs()).toBe(false);

    http.expectOne('/dashboard/summary').flush({ data: SUMMARY_ROW });
  });
});
