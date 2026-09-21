import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { DashboardSummary } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Dashboard state.
 *
 * One request backs the whole page (decision D4), so every widget reads the
 * same status. Each widget still renders and retries its own error state, and
 * Retry re-fetches for all of them — splitting the endpoint per widget is what
 * it would take to make them fail independently.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(ApiService);

  private readonly _summary = signal<DashboardSummary | null>(null);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);

  readonly summary = this._summary.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  readonly boothFillByFair = computed(() => this._summary()?.boothFillByFair ?? []);
  readonly pipelineByStage = computed(() => this._summary()?.pipelineByStage ?? []);

  /** True once loaded but with nothing to show — an empty state, not an error. */
  readonly hasNoActiveFairs = computed(
    () => this._status() === 'success' && this.boothFillByFair().length === 0,
  );

  async load(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      this._summary.set(await firstValueFrom(this.api.get<DashboardSummary>('/dashboard/summary')));
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }
}
