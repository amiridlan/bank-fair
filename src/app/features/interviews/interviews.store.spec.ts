import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InterviewsStore } from './interviews.store';

function slotRow(hour: number, minute: number, booked: [string, string] | null) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const endMinute = minute + 20;
  return {
    id: `slot-fair-01-emp-001-${pad(hour)}${pad(minute)}`,
    fair_id: 'fair-01',
    employer_id: 'emp-001',
    start_time: `2026-09-21T${pad(hour)}:${pad(minute)}:00+08:00`,
    end_time: `2026-09-21T${pad(endMinute === 60 ? hour + 1 : hour)}:${pad(endMinute % 60)}:00+08:00`,
    candidate_id: booked?.[0] ?? null,
    candidate_name: booked?.[1] ?? null,
  };
}

const SLOTS = [
  slotRow(10, 0, ['cand-001', 'Nur Aisyah binti Rahman']),
  slotRow(10, 20, null),
  slotRow(10, 40, null),
];

describe('InterviewsStore', () => {
  let store: InterviewsStore;
  let http: HttpTestingController;

  async function loadFixture(): Promise<void> {
    const loading = store.load('fair-01');
    http.expectOne((r) => r.url === '/interview-slots').flush({ data: SLOTS });
    await loading;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(InterviewsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('scopes the request to the active fair', () => {
    void store.load('fair-02');
    const req = http.expectOne((r) => r.url === '/interview-slots');

    expect(req.request.params.get('fair_id')).toBe('fair-02');
    req.flush({ data: [] });
  });

  it('returns an empty grid without a request when no fair is active', async () => {
    await store.load(null);

    expect(store.slots()).toEqual([]);
    expect(store.status()).toBe('success');
    expect(store.hasError()).toBe(false);
    // http.verify() in afterEach confirms nothing was requested.
  });

  it('counts booked slots and lists their candidates', async () => {
    await loadFixture();

    expect(store.slots()).toHaveLength(3);
    expect(store.bookedCount()).toBe(1);
    expect(store.bookedCandidateIds().has('cand-001')).toBe(true);
    expect(store.bookedCandidateIds().has('cand-002')).toBe(false);
  });

  it('distinguishes no slots from an error', async () => {
    const loading = store.load('fair-04');
    http.expectOne((r) => r.url === '/interview-slots').flush({ data: [] });
    await loading;

    expect(store.hasNoSlots()).toBe(true);
    expect(store.hasError()).toBe(false);
  });

  it('sets an error signal on a failed load', async () => {
    const loading = store.load('fair-01');
    http
      .expectOne((r) => r.url === '/interview-slots')
      .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
    await loading;

    expect(store.hasError()).toBe(true);
    expect(store.error()?.status).toBe(500);
  });

  describe('book', () => {
    it('sends the candidate and stores the server version', async () => {
      await loadFixture();
      const target = store.slots()[1];

      const booking = store.book(target.id, 'cand-002');
      expect(store.pendingSlotId()).toBe(target.id);

      const req = http.expectOne(`/interview-slots/${target.id}`);
      expect(req.request.body).toEqual({ candidate_id: 'cand-002' });
      req.flush({ data: slotRow(10, 20, ['cand-002', 'Wei Ming Tan']) });
      const result = await booking;

      expect(result.error).toBeNull();
      expect(result.conflict).toBe(false);
      expect(store.slotById(target.id)?.candidateName).toBe('Wei Ming Tan');
      expect(store.bookedCount()).toBe(2);
      expect(store.pendingSlotId()).toBeNull();
    });

    it('does not show a booking before the server confirms it', async () => {
      await loadFixture();
      const target = store.slots()[1];

      void store.book(target.id, 'cand-002');

      // Deliberately not optimistic: a 409 here would mean showing a booking
      // that does not exist.
      expect(store.slotById(target.id)?.candidateId).toBeNull();

      http
        .expectOne(`/interview-slots/${target.id}`)
        .flush({ data: slotRow(10, 20, ['cand-002', 'Wei Ming Tan']) });
    });

    it('reloads the grid on a 409 so the user picks from what is free', async () => {
      await loadFixture();
      const target = store.slots()[1];

      const booking = store.book(target.id, 'cand-002');
      http
        .expectOne(`/interview-slots/${target.id}`)
        .flush(
          { message: 'That slot was just booked. Pick another.' },
          { status: 409, statusText: 'Conflict' },
        );

      // The refetch is issued from the catch block, so let the microtask queue
      // drain before expecting it.
      await new Promise((resolve) => setTimeout(resolve, 0));

      http
        .expectOne((r) => r.url === '/interview-slots')
        .flush({ data: [SLOTS[0], slotRow(10, 20, ['cand-009', 'Someone Else']), SLOTS[2]] });
      const result = await booking;

      expect(result.conflict).toBe(true);
      expect(result.error?.message).toBe('That slot was just booked. Pick another.');
      expect(store.slotById(target.id)?.candidateName).toBe('Someone Else');
    });

    it('reports a non-conflict failure without reloading', async () => {
      await loadFixture();
      const target = store.slots()[1];

      const booking = store.book(target.id, 'cand-002');
      http
        .expectOne(`/interview-slots/${target.id}`)
        .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
      const result = await booking;

      expect(result.conflict).toBe(false);
      expect(result.error?.status).toBe(500);
      expect(store.slotById(target.id)?.candidateId).toBeNull();
    });

    it('surfaces a 422 when the candidate is not shortlisted', async () => {
      await loadFixture();
      const target = store.slots()[1];

      const booking = store.book(target.id, 'cand-777');
      http.expectOne(`/interview-slots/${target.id}`).flush(
        {
          message: 'Shortlist this candidate before booking an interview.',
          errors: { candidate_id: ['Shortlist this candidate before booking an interview.'] },
        },
        { status: 422, statusText: 'Unprocessable' },
      );
      const result = await booking;

      expect(result.conflict).toBe(false);
      expect(result.error?.fieldErrors['candidateId']).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('frees the slot optimistically', async () => {
      await loadFixture();
      const booked = store.slots()[0];

      const cancelling = store.cancel(booked.id);
      // Cancelling only removes a booking, so showing it immediately is safe.
      expect(store.slotById(booked.id)?.candidateId).toBeNull();
      expect(store.bookedCount()).toBe(0);

      http.expectOne(`/interview-slots/${booked.id}`).flush({ data: slotRow(10, 0, null) });
      expect(await cancelling).toBeNull();
    });

    it('sends null to clear the booking', async () => {
      await loadFixture();
      const booked = store.slots()[0];

      const cancelling = store.cancel(booked.id);
      const req = http.expectOne(`/interview-slots/${booked.id}`);

      expect(req.request.body).toEqual({ candidate_id: null });
      req.flush({ data: slotRow(10, 0, null) });
      await cancelling;
    });

    it('restores the booking when the request fails', async () => {
      await loadFixture();
      const booked = store.slots()[0];
      const before = store.slots();

      const cancelling = store.cancel(booked.id);
      expect(store.bookedCount()).toBe(0);

      http
        .expectOne(`/interview-slots/${booked.id}`)
        .flush({ message: 'Server error.' }, { status: 500, statusText: 'Error' });
      const error = await cancelling;

      expect(error?.status).toBe(500);
      expect(store.slots()).toEqual(before);
      expect(store.slotById(booked.id)?.candidateName).toBe('Nur Aisyah binti Rahman');
      expect(store.pendingSlotId()).toBeNull();
    });
  });
});
