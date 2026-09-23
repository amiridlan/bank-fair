import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_FILTERS, TalentPoolStore } from './talent-pool.store';

function candidateRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    full_name: `Candidate ${id}`,
    university: 'Universiti Malaya',
    field_of_study: 'Computer Science',
    qualification: 'degree',
    graduation_year: 2026,
    cgpa: 3.5,
    skills: ['Java', 'SQL', 'Git', 'Docker', 'Linux'],
    headline: 'Final-year Computer Science student',
    email: 'c***@example.com',
    phone: null,
    is_contact_visible: false,
    fair_ids: ['fair-01'],
    ...overrides,
  };
}

const META = { current_page: 2, per_page: 20, total: 300, last_page: 15 };

describe('TalentPoolStore', () => {
  let store: TalentPoolStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(TalentPoolStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads a page and exposes the pagination meta', async () => {
    const loading = store.load(DEFAULT_FILTERS);
    expect(store.isLoading()).toBe(true);

    http
      .expectOne((r) => r.url === '/candidates')
      .flush({ data: [candidateRow('cand-001')], meta: META });
    await loading;

    expect(store.status()).toBe('success');
    expect(store.candidates()[0].fullName).toBe('Candidate cand-001');
    expect(store.candidates()[0].isContactVisible).toBe(false);
    expect(store.meta()).toEqual({ currentPage: 2, perPage: 20, total: 300, lastPage: 15 });
  });

  it('sends only the filters that are set, in snake_case', () => {
    void store.load({
      ...DEFAULT_FILTERS,
      search: '  python  ',
      minCgpa: 3.5,
      gradYear: null,
      sort: 'cgpa',
      dir: 'desc',
      page: 3,
    });

    const req = http.expectOne((r) => r.url === '/candidates');

    expect(req.request.params.get('search')).toBe('python');
    expect(req.request.params.get('min_cgpa')).toBe('3.5');
    expect(req.request.params.get('sort')).toBe('cgpa');
    expect(req.request.params.get('dir')).toBe('desc');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('per_page')).toBe('20');
    // Unset filters must be absent, not sent as "null".
    expect(req.request.params.has('grad_year')).toBe(false);
    expect(req.request.params.has('university')).toBe(false);

    req.flush({ data: [], meta: META });
  });

  it('sets an error signal rather than throwing', async () => {
    const loading = store.load(DEFAULT_FILTERS);
    http
      .expectOne((r) => r.url === '/candidates')
      .flush({ message: 'Something went wrong on our side.' }, { status: 500, statusText: 'Error' });
    await loading;

    expect(store.hasError()).toBe(true);
    expect(store.error()?.status).toBe(500);
  });

  it('distinguishes an empty result from an error', async () => {
    const loading = store.load({ ...DEFAULT_FILTERS, minCgpa: 4 });
    http
      .expectOne((r) => r.url === '/candidates')
      .flush({ data: [], meta: { ...META, total: 0, current_page: 1 } });
    await loading;

    expect(store.isEmpty()).toBe(true);
    expect(store.hasError()).toBe(false);
  });

  it('reports active filters, ignoring a whitespace-only search', async () => {
    const loading = store.load({ ...DEFAULT_FILTERS, search: '   ' });
    http.expectOne((r) => r.url === '/candidates').flush({ data: [], meta: META });
    await loading;

    expect(store.hasActiveFilters()).toBe(false);
  });

  it('does not treat sort or page as a filter', async () => {
    const loading = store.load({ ...DEFAULT_FILTERS, sort: 'cgpa', dir: 'desc', page: 4 });
    http.expectOne((r) => r.url === '/candidates').flush({ data: [], meta: META });
    await loading;

    // Otherwise "Clear filters" would appear just because a column was sorted.
    expect(store.hasActiveFilters()).toBe(false);
  });

  describe('profile modal', () => {
    it('always fetches, so a deep link works on a cold load', async () => {
      const loading = store.loadOne('cand-007');
      http.expectOne('/candidates/cand-007').flush({ data: candidateRow('cand-007') });
      await loading;

      expect(store.selected()?.id).toBe('cand-007');
      expect(store.selectedStatus()).toBe('success');
    });

    it('clears the selection on failure rather than showing a stale profile', async () => {
      const first = store.loadOne('cand-001');
      http.expectOne('/candidates/cand-001').flush({ data: candidateRow('cand-001') });
      await first;

      const missing = store.loadOne('cand-999');
      http
        .expectOne('/candidates/cand-999')
        .flush({ message: 'Candidate not found.' }, { status: 404, statusText: 'Not Found' });
      await missing;

      expect(store.selected()).toBeNull();
      expect(store.selectedStatus()).toBe('error');
    });
  });

  describe('patchCandidate', () => {
    it('replaces the row in the list after shortlisting unmasks it', async () => {
      const loading = store.load(DEFAULT_FILTERS);
      http
        .expectOne((r) => r.url === '/candidates')
        .flush({ data: [candidateRow('cand-001'), candidateRow('cand-002')], meta: META });
      await loading;

      store.patchCandidate({
        ...store.candidates()[0],
        email: 'real.name@example.com',
        phone: '+60 12-000 0001',
        isContactVisible: true,
      });

      expect(store.candidates()[0].email).toBe('real.name@example.com');
      expect(store.candidates()[0].isContactVisible).toBe(true);
      // The other row is untouched.
      expect(store.candidates()[1].isContactVisible).toBe(false);
    });

    it('also updates the open modal when it is the same candidate', async () => {
      const loading = store.loadOne('cand-001');
      http.expectOne('/candidates/cand-001').flush({ data: candidateRow('cand-001') });
      await loading;

      store.patchCandidate({ ...store.selected()!, isContactVisible: true });

      expect(store.selected()?.isContactVisible).toBe(true);
    });
  });
});
