import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Candidate, PaginationMeta } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

/** Columns the API can sort by. Anything else falls back to name. */
export type SortField = 'fullName' | 'university' | 'graduationYear' | 'cgpa';
export type SortDirection = 'asc' | 'desc';

export interface TalentFilters {
  readonly search: string;
  readonly university: string | null;
  readonly field: string | null;
  readonly gradYear: number | null;
  readonly minCgpa: number | null;
  readonly sort: SortField;
  readonly dir: SortDirection;
  readonly page: number;
  readonly perPage: number;
}

export const DEFAULT_FILTERS: TalentFilters = {
  search: '',
  university: null,
  field: null,
  gradYear: null,
  minCgpa: null,
  sort: 'fullName',
  dir: 'asc',
  page: 1,
  perPage: 20,
};

const EMPTY_META: PaginationMeta = { currentPage: 1, perPage: 20, total: 0, lastPage: 1 };

@Injectable({ providedIn: 'root' })
export class TalentPoolStore {
  private readonly api = inject(ApiService);

  private readonly _candidates = signal<readonly Candidate[]>([]);
  private readonly _meta = signal<PaginationMeta>(EMPTY_META);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _filters = signal<TalentFilters>(DEFAULT_FILTERS);

  /** The candidate whose profile modal is open, loaded by deep link. */
  private readonly _selected = signal<Candidate | null>(null);
  private readonly _selectedStatus = signal<LoadStatus>('idle');

  readonly candidates = this._candidates.asReadonly();
  readonly meta = this._meta.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly selectedStatus = this._selectedStatus.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(
    () => this._status() === 'success' && this._candidates().length === 0,
  );

  readonly hasActiveFilters = computed(() => {
    const f = this._filters();
    return (
      f.search.trim() !== '' ||
      f.university !== null ||
      f.field !== null ||
      f.gradYear !== null ||
      f.minCgpa !== null
    );
  });

  /**
   * Fetches a page of candidates.
   *
   * Sorting and pagination are done by the API rather than in the browser:
   * with 300 candidates the difference is invisible, but the semantics have
   * to match what Laravel will do or the swap would change behaviour.
   */
  async load(filters: TalentFilters): Promise<void> {
    this._filters.set(filters);
    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getList<Candidate>('/candidates', {
          search: filters.search.trim() || null,
          university: filters.university,
          field: filters.field,
          gradYear: filters.gradYear,
          minCgpa: filters.minCgpa,
          sort: filters.sort,
          dir: filters.dir,
          page: filters.page,
          perPage: filters.perPage,
        }),
      );
      this._candidates.set(response.data);
      this._meta.set(response.meta);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Loads one candidate for the profile modal.
   *
   * Always fetched rather than read from the current page, so a deep link
   * works on a cold load and the contact details reflect the latest shortlist
   * state rather than whatever the list happened to carry.
   */
  async loadOne(candidateId: string): Promise<void> {
    this._selectedStatus.set('loading');
    try {
      this._selected.set(
        await firstValueFrom(this.api.get<Candidate>(`/candidates/${candidateId}`)),
      );
      this._selectedStatus.set('success');
    } catch {
      this._selected.set(null);
      this._selectedStatus.set('error');
    }
  }

  clearSelection(): void {
    this._selected.set(null);
    this._selectedStatus.set('idle');
  }

  /**
   * Replaces a candidate wherever it appears, after a shortlist unmasks it.
   * Avoids a refetch just to reveal an email the response already carried.
   */
  patchCandidate(candidate: Candidate): void {
    this._candidates.set(
      this._candidates().map((entry) => (entry.id === candidate.id ? candidate : entry)),
    );
    if (this._selected()?.id === candidate.id) {
      this._selected.set(candidate);
    }
  }
}
