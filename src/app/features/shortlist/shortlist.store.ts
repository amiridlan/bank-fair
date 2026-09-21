import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Candidate, Shortlist } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ShortlistResult {
  readonly error: ApiError | null;
  /** True when this candidate is already on the shortlist for this fair. */
  readonly duplicate: boolean;
  /** The created entry's unmasked candidate, for patching the list in place. */
  readonly candidate: Candidate | null;
}

@Injectable({ providedIn: 'root' })
export class ShortlistStore {
  private readonly api = inject(ApiService);

  private readonly _entries = signal<readonly Shortlist[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _fairId = signal<string | null>(null);
  private readonly _busyCandidateId = signal<string | null>(null);

  readonly entries = this._entries.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busyCandidateId = this._busyCandidateId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(() => this._status() === 'success' && this._entries().length === 0);
  readonly count = computed(() => this._entries().length);

  /** Candidate ids on the shortlist, so the table can mark rows already added. */
  readonly shortlistedIds = computed(
    () => new Set(this._entries().map((entry) => entry.candidateId)),
  );

  isShortlisted(candidateId: string): boolean {
    return this.shortlistedIds().has(candidateId);
  }

  async load(fairId: string | null): Promise<void> {
    this._fairId.set(fairId);

    // Without a fair there is nothing to scope to; an empty list is the
    // honest answer, not an error.
    if (!fairId) {
      this._entries.set([]);
      this._status.set('success');
      return;
    }

    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getList<Shortlist>('/shortlists', { fairId }),
      );
      this._entries.set(response.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Adds a candidate to the shortlist for a fair.
   *
   * Not optimistic: the response carries the candidate with contact details
   * unmasked, which is the point of shortlisting. Guessing it locally would
   * mean inventing an email we do not have.
   *
   * A 409 means they are already on the list — a normal outcome the caller
   * reports plainly rather than as a failure.
   */
  async add(candidateId: string, fairId: string, note: string | null): Promise<ShortlistResult> {
    this._busyCandidateId.set(candidateId);

    try {
      const created = await firstValueFrom(
        this.api.post<Shortlist>('/shortlists', { candidateId, fairId, note }),
      );
      this._entries.set([created, ...this._entries()]);
      return { error: null, duplicate: false, candidate: created.candidate };
    } catch (err: unknown) {
      const error = toApiError(err);
      return { error, duplicate: error.status === 409, candidate: null };
    } finally {
      this._busyCandidateId.set(null);
    }
  }

  /** Removes an entry optimistically, restoring it if the request fails. */
  async remove(shortlistId: string): Promise<ApiError | null> {
    const snapshot = this._entries();
    this._entries.set(snapshot.filter((entry) => entry.id !== shortlistId));

    try {
      await firstValueFrom(this.api.delete(`/shortlists/${shortlistId}`));
      return null;
    } catch (err: unknown) {
      this._entries.set(snapshot);
      return toApiError(err);
    }
  }

  entryForCandidate(candidateId: string): Shortlist | null {
    return this._entries().find((entry) => entry.candidateId === candidateId) ?? null;
  }
}
