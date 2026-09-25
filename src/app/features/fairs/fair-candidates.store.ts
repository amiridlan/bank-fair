import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Candidate, PaginationMeta } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

const EMPTY_META: PaginationMeta = { currentPage: 1, lastPage: 1, perPage: 25, total: 0 };

/**
 * The job seekers registered for one fair, read by staff (docs/11 V2).
 *
 * Separate from `TalentPoolStore` rather than sharing it, for the reason the
 * audit store keeps two slices: these are two readers asking different
 * questions of the same endpoint. The talent pool is an employer sourcing
 * candidates across every fair they attend, with filters and a sort they
 * control; this is a staff member asking who signed up for *this* fair. One
 * store would mean one view's paging and filters silently moving the other's.
 *
 * Contact details arrive masked and stay that way. Staff run the fairs, which
 * is a reason to show them who registered, not a reason to hand them everyone's
 * email address (docs/11 V-D3). The masking is applied by the API, so this
 * store could not unmask it even if a component asked.
 */
@Injectable({ providedIn: 'root' })
export class FairCandidatesStore {
  private readonly api = inject(ApiService);

  private readonly _candidates = signal<readonly Candidate[]>([]);
  private readonly _meta = signal<PaginationMeta>(EMPTY_META);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);

  readonly candidates = this._candidates.asReadonly();
  readonly meta = this._meta.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(
    () => this._status() === 'success' && this._candidates().length === 0,
  );

  /** How many distinct universities are represented on this page. */
  readonly universityCount = computed(
    () => new Set(this._candidates().map((candidate) => candidate.university)).size,
  );

  async load(fairId: string, page = 1): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getList<Candidate>('/candidates', {
          fair_id: fairId,
          page,
          per_page: 25,
          sort: 'fullName',
        }),
      );
      this._candidates.set(response.data);
      this._meta.set(response.meta);
      this._status.set('success');
    } catch (err: unknown) {
      this._candidates.set([]);
      this._meta.set(EMPTY_META);
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }
}
