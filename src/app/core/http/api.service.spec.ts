import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';

interface TestFair {
  readonly id: string;
  readonly boothTotal: number;
}

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps the data envelope and camelCases the payload', async () => {
    const result = api.get<TestFair>('/fairs/fair-01');
    const promise = new Promise<TestFair>((resolve) => result.subscribe(resolve));

    http
      .expectOne('/fairs/fair-01')
      .flush({ data: { id: 'fair-01', booth_total: 40 } });

    await expect(promise).resolves.toEqual({ id: 'fair-01', boothTotal: 40 });
  });

  it('returns pagination meta for a collection', async () => {
    const promise = new Promise((resolve) => api.getList<TestFair>('/fairs').subscribe(resolve));

    http.expectOne('/fairs').flush({
      data: [{ id: 'fair-01', booth_total: 40 }],
      meta: { current_page: 1, per_page: 20, total: 312, last_page: 16 },
    });

    await expect(promise).resolves.toEqual({
      data: [{ id: 'fair-01', boothTotal: 40 }],
      meta: { currentPage: 1, perPage: 20, total: 312, lastPage: 16 },
    });
  });

  it('synthesises meta when an endpoint returns an unpaginated collection', async () => {
    const promise = new Promise((resolve) => api.getList<TestFair>('/fairs').subscribe(resolve));

    http.expectOne('/fairs').flush({ data: [{ id: 'fair-01', booth_total: 40 }] });

    await expect(promise).resolves.toEqual({
      data: [{ id: 'fair-01', boothTotal: 40 }],
      meta: { currentPage: 1, perPage: 1, total: 1, lastPage: 1 },
    });
  });

  it('snake_cases query parameter names and drops empty values', () => {
    api.getList('/candidates', { minCgpa: 3.5, gradYear: null, search: '', perPage: 20 }).subscribe();

    const req = http.expectOne((r) => r.url === '/candidates');

    expect(req.request.params.get('min_cgpa')).toBe('3.5');
    expect(req.request.params.get('per_page')).toBe('20');
    expect(req.request.params.has('grad_year')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ data: [] });
  });

  it('snake_cases an outgoing request body', () => {
    api.post('/employers', { contactEmail: 'a@example.com', boothPackage: 'premium' }).subscribe();

    const req = http.expectOne('/employers');

    expect(req.request.body).toEqual({
      contact_email: 'a@example.com',
      booth_package: 'premium',
    });
    req.flush({ data: {} });
  });

  it('sends a PATCH body in snake_case and camelCases the response', async () => {
    const promise = new Promise((resolve) =>
      api.patch('/employers/emp-001', { stage: 'paid' }).subscribe(resolve),
    );

    const req = http.expectOne('/employers/emp-001');
    expect(req.request.method).toBe('PATCH');
    req.flush({ data: { id: 'emp-001', deal_value_myr: 7500 } });

    await expect(promise).resolves.toEqual({ id: 'emp-001', dealValueMyr: 7500 });
  });
});
