import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Fair, FairStatus } from '../../core/models';
import { hasEnded } from '../../core/fairs/fair-timing';

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
type FairBucket = 'current' | 'past' | 'complete';

/** Which group a fair belongs to. The ended rule is shared — see fair-timing. */
function bucketOf(fair: Fair, now: number): FairBucket {
  if (fair.status === 'completed') {
    return 'complete';
  }
  return hasEnded(fair, now) ? 'past' : 'current';
}

/** The two backward-looking groups read newest first. */
function byEndDateDesc(fairs: readonly Fair[], bucket: FairBucket): readonly Fair[] {
  const now = Date.now();
  return [...fairs]
    .filter((fair) => bucketOf(fair, now) === bucket)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

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

  /**
   * Fairs still ahead or happening now, live ones first.
   *
   * "Future" is by end date, not start: a two-day fair on its second day is
   * still current, and sorting by start would bury it under fairs that have
   * not begun.
   */
  readonly currentFairs = computed<readonly Fair[]>(() => {
    const now = Date.now();
    return [...this._fairs()]
      .filter((fair) => bucketOf(fair, now) === 'current')
      .sort(
        (a, b) =>
          Number(b.status === 'live') - Number(a.status === 'live') ||
          a.startDate.localeCompare(b.startDate),
      );
  });

  /**
   * Over, but never closed out.
   *
   * Separate from Complete on purpose: a fair whose dates have passed while
   * its status still says open is work outstanding — booths to reconcile, a
   * status somebody has to set — not an archive entry. Merging the two would
   * hide exactly the fairs that need attention.
   */
  readonly pastFairs = computed<readonly Fair[]>(() => byEndDateDesc(this._fairs(), 'past'));

  /** Closed out by staff. The archive. */
  readonly completeFairs = computed<readonly Fair[]>(() =>
    byEndDateDesc(this._fairs(), 'complete'),
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
