import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ShortlistStore } from './shortlist.store';

function candidateRow(id: string, visible = true) {
  return {
    id,
    full_name: `Candidate ${id}`,
    university: 'Universiti Malaya',
    field_of_study: 'Computer Science',
    qualification: 'degree',
    graduation_year: 2026,
    cgpa: 3.5,
    skills: ['Java'],
    headline: 'Final-year student',
    email: visible ? 'real.name@example.com' : 'r***@example.com',
    phone: visible ? '+60 12-000 0001' : null,
    is_contact_visible: visible,
    fair_ids: ['fair-01'],
  };
}

function entryRow(id: string, candidateId: string) {
  return {
    id,
    employer_id: 'emp-001',
    candidate_id: candidateId,
    fair_id: 'fair-01',
    note: null,
    created_at: '2026-09-15T11:00:00+08:00',
    candidate: candidateRow(candidateId),
  };
}

describe('ShortlistStore', () => {
  let store: ShortlistStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ShortlistStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function loadTwo(): Promise<void> {
    const loading = store.load('fair-01');
    http
      .expectOne((r) => r.url === '/shortlists')
      .flush({ data: [entryRow('sl-001', 'cand-001'), entryRow('sl-002', 'cand-002')] });
    await loading;
  }

  it('scopes the request to the active fair', () => {
    void store.load('fair-02');
    const req = http.expectOne((r) => r.url === '/shortlists');

    expect(req.request.params.get('fair_id')).toBe('fair-02');
    req.flush({ data: [] });
  });

  it('returns an empty list without a request when no fair is active', async () => {
    await store.load(null);

    // An absent fair is not an error — there is simply nothing to scope to.
    expect(store.entries()).toEqual([]);
    expect(store.status()).toBe('success');
    expect(store.hasError()).toBe(false);
    // http.verify() in afterEach confirms no request was made.
  });

  it('exposes shortlisted ids for the table markers', async () => {
    await loadTwo();

    expect(store.isShortlisted('cand-001')).toBe(true);
    expect(store.isShortlisted('cand-999')).toBe(false);
    expect(store.count()).toBe(2);
  });

  it('sets an error signal on failure', async () => {
    const loading = store.load('fair-01');
    http
      .expectOne((r) => r.url === '/shortlists')
      .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
    await loading;

    expect(store.hasError()).toBe(true);
  });

  describe('add', () => {
    it('prepends the new entry and returns the unmasked candidate', async () => {
      await loadTwo();

      const adding = store.add('cand-003', 'fair-01', 'Strong portfolio.');
      const req = http.expectOne('/shortlists');
      expect(req.request.body).toEqual({
        candidate_id: 'cand-003',
        fair_id: 'fair-01',
        note: 'Strong portfolio.',
      });

      req.flush({ data: entryRow('sl-003', 'cand-003') }, { status: 201, statusText: 'Created' });
      const result = await adding;

      expect(result.error).toBeNull();
      expect(result.duplicate).toBe(false);
      // Shortlisting is what unlocks contact details.
      expect(result.candidate?.isContactVisible).toBe(true);
      expect(store.entries()[0].id).toBe('sl-003');
      expect(store.isShortlisted('cand-003')).toBe(true);
    });

    it('reports a 409 as a duplicate, not a failure', async () => {
      await loadTwo();
      const before = store.entries();

      const adding = store.add('cand-001', 'fair-01', null);
      http
        .expectOne('/shortlists')
        .flush(
          { message: 'Candidate cand-001 is already on your shortlist for this fair.' },
          { status: 409, statusText: 'Conflict' },
        );
      const result = await adding;

      expect(result.duplicate).toBe(true);
      expect(result.error?.status).toBe(409);
      // Nothing added twice.
      expect(store.entries()).toEqual(before);
    });

    it('adds nothing when the request fails outright', async () => {
      await loadTwo();

      const adding = store.add('cand-003', 'fair-01', null);
      http.expectOne('/shortlists').flush({}, { status: 500, statusText: 'Error' });
      const result = await adding;

      expect(result.duplicate).toBe(false);
      expect(result.candidate).toBeNull();
      expect(store.count()).toBe(2);
    });

    it('clears the busy marker even when the request fails', async () => {
      const adding = store.add('cand-003', 'fair-01', null);
      expect(store.busyCandidateId()).toBe('cand-003');

      http.expectOne('/shortlists').flush({}, { status: 500, statusText: 'Error' });
      await adding;

      expect(store.busyCandidateId()).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes optimistically', async () => {
      await loadTwo();

      const removing = store.remove('sl-001');
      // Gone before the server answers.
      expect(store.count()).toBe(1);
      expect(store.isShortlisted('cand-001')).toBe(false);

      http.expectOne('/shortlists/sl-001').flush(null, { status: 204, statusText: 'No Content' });
      expect(await removing).toBeNull();
      expect(store.count()).toBe(1);
    });

    it('restores the entry when the request fails', async () => {
      await loadTwo();
      const before = store.entries();

      const removing = store.remove('sl-001');
      expect(store.count()).toBe(1);

      http.expectOne('/shortlists/sl-001').flush({}, { status: 500, statusText: 'Error' });
      const error = await removing;

      expect(error?.status).toBe(500);
      expect(store.entries()).toEqual(before);
      expect(store.isShortlisted('cand-001')).toBe(true);
    });
  });

  it('finds the entry for a candidate, so the profile can remove it', async () => {
    await loadTwo();

    expect(store.entryForCandidate('cand-002')?.id).toBe('sl-002');
    expect(store.entryForCandidate('cand-999')).toBeNull();
  });
});
