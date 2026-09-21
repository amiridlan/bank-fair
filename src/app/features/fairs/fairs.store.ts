import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Fair, FairStatus } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FairFilters {
  readonly status: FairStatus | null;
  readonly city: string | null;
}

export const NO_FILTERS: FairFilters = { status: null, city: null };

/**
 * Fairs state, following the store pattern in docs/04: private writable
 * signals, public readonly ones, and every API call wrapped so an error lands
 * on a signal rather than escaping.
 */
@Injectable({ providedIn: 'root' })
export class FairsStore {
  private readonly api = inject(ApiService);

  private readonly _fairs = signal<readonly Fair[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _filters = signal<FairFilters>(NO_FILTERS);

  private readonly _selected = signal<Fair | null>(null);
  private readonly _selectedStatus = signal<LoadStatus>('idle');
  private readonly _selectedError = signal<ApiError | null>(null);

  readonly fairs = this._fairs.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly selectedStatus = this._selectedStatus.asReadonly();
  readonly selectedError = this._selectedError.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(() => this._status() === 'success' && this._fairs().length === 0);

  readonly hasActiveFilters = computed(
    () => this._filters().status !== null || this._filters().city !== null,
  );

  /** Cities present in the loaded set, for the filter dropdown. */
  readonly cities = computed(() =>
    [...new Set(this._fairs().map((fair) => fair.city))].sort((a, b) => a.localeCompare(b)),
  );

  /** The next fair a hiring manager would care about: live first, then soonest. */
  readonly nextActiveFair = computed<Fair | null>(() => {
    const active = this._fairs().filter(
      (fair) => fair.status === 'live' || fair.status === 'open',
    );
    if (active.length === 0) {
      return null;
    }
    return [...active].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'live' ? -1 : 1;
      }
      return a.startDate.localeCompare(b.startDate);
    })[0];
  });

  async load(filters: FairFilters = this._filters()): Promise<void> {
    this._filters.set(filters);
    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getList<Fair>('/fairs', { status: filters.status, city: filters.city }),
      );
      this._fairs.set(response.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  async loadOne(fairId: string): Promise<void> {
    this._selectedStatus.set('loading');
    this._selectedError.set(null);

    try {
      this._selected.set(await firstValueFrom(this.api.get<Fair>(`/fairs/${fairId}`)));
      this._selectedStatus.set('success');
    } catch (err: unknown) {
      this._selected.set(null);
      this._selectedError.set(toApiError(err));
      this._selectedStatus.set('error');
    }
  }

  clearFilters(): Promise<void> {
    return this.load(NO_FILTERS);
  }
}
