import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { InterviewSlot } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface BookResult {
  readonly error: ApiError | null;
  /** True when the slot was taken, or the candidate already has an interview. */
  readonly conflict: boolean;
}

@Injectable({ providedIn: 'root' })
export class InterviewsStore {
  private readonly api = inject(ApiService);

  private readonly _slots = signal<readonly InterviewSlot[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _fairId = signal<string | null>(null);
  private readonly _pendingSlotId = signal<string | null>(null);

  readonly slots = this._slots.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingSlotId = this._pendingSlotId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly hasNoSlots = computed(() => this._status() === 'success' && this._slots().length === 0);

  readonly bookedCount = computed(
    () => this._slots().filter((slot) => slot.candidateId !== null).length,
  );

  /** Candidates already holding a slot, so the booking dialog can exclude them. */
  readonly bookedCandidateIds = computed(
    () =>
      new Set(
        this._slots()
          .map((slot) => slot.candidateId)
          .filter((id): id is string => id !== null),
      ),
  );

  async load(fairId: string | null): Promise<void> {
    this._fairId.set(fairId);

    // No active fair means no grid to show; that is an empty state, not an
    // error, and there is nothing to ask the API for.
    if (!fairId) {
      this._slots.set([]);
      this._status.set('success');
      return;
    }

    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getList<InterviewSlot>('/interview-slots', { fairId }),
      );
      this._slots.set(response.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Books a candidate into a slot.
   *
   * Deliberately not optimistic. A 409 here means someone else took the slot
   * in the meantime — exactly the case an optimistic update would paper over,
   * showing a booking that does not exist. On conflict the grid is reloaded so
   * the user picks from what is actually free.
   */
  async book(slotId: string, candidateId: string): Promise<BookResult> {
    this._pendingSlotId.set(slotId);

    try {
      const updated = await firstValueFrom(
        this.api.patch<InterviewSlot>(`/interview-slots/${slotId}`, { candidateId }),
      );
      this.replace(updated);
      return { error: null, conflict: false };
    } catch (err: unknown) {
      const error = toApiError(err);
      if (error.status === 409) {
        // Someone else's booking is now the truth; show it.
        await this.load(this._fairId());
        return { error, conflict: true };
      }
      return { error, conflict: false };
    } finally {
      this._pendingSlotId.set(null);
    }
  }

  /** Frees a slot. Optimistic: cancelling only ever removes a booking. */
  async cancel(slotId: string): Promise<ApiError | null> {
    const snapshot = this._slots();
    this._slots.set(
      snapshot.map((slot) =>
        slot.id === slotId ? { ...slot, candidateId: null, candidateName: null } : slot,
      ),
    );
    this._pendingSlotId.set(slotId);

    try {
      this.replace(
        await firstValueFrom(
          this.api.patch<InterviewSlot>(`/interview-slots/${slotId}`, { candidateId: null }),
        ),
      );
      return null;
    } catch (err: unknown) {
      this._slots.set(snapshot);
      return toApiError(err);
    } finally {
      this._pendingSlotId.set(null);
    }
  }

  slotById(slotId: string): InterviewSlot | null {
    return this._slots().find((slot) => slot.id === slotId) ?? null;
  }

  private replace(slot: InterviewSlot): void {
    this._slots.set(this._slots().map((entry) => (entry.id === slot.id ? slot : entry)));
  }
}
