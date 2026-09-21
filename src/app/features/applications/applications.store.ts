import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { ApplicationStatus, Fair, FairApplication } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApplyResult {
  readonly error: ApiError | null;
  /** True when they already have a pending or approved application. */
  readonly conflict: boolean;
}

/**
 * Fair applications, read by both sides of the review.
 *
 * One store rather than two because the rows are the same rows; the API
 * decides which of them a caller may see, not the client.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsStore {
  private readonly api = inject(ApiService);

  private readonly _applications = signal<readonly FairApplication[]>([]);
  private readonly _fairs = signal<readonly Fair[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _busyId = signal<string | null>(null);

  readonly applications = this._applications.asReadonly();
  readonly fairs = this._fairs.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busyId = this._busyId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  readonly pending = computed(() =>
    this._applications().filter((entry) => entry.status === 'pending'),
  );
  readonly decided = computed(() =>
    this._applications().filter((entry) => entry.status !== 'pending'),
  );
  readonly pendingCount = computed(() => this.pending().length);

  /** Fairs still accepting applications. */
  readonly openFairs = computed(() =>
    this._fairs().filter((fair) => fair.status === 'open' || fair.status === 'live'),
  );

  readonly fairName = computed(() => {
    const byId = new Map(this._fairs().map((fair) => [fair.id, fair.name]));
    return (fairId: string) => byId.get(fairId) ?? 'Unknown fair';
  });

  async load(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const [applications, fairs] = await Promise.all([
        firstValueFrom(this.api.getList<FairApplication>('/fair-applications')),
        firstValueFrom(this.api.getList<Fair>('/fairs')),
      ]);

      this._applications.set(applications.data);
      this._fairs.set(fairs.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /** An employer applies. Not optimistic: staff decide, so there is nothing to guess. */
  async apply(fairId: string): Promise<ApplyResult> {
    this._busyId.set(fairId);

    try {
      const application = await firstValueFrom(
        this.api.post<FairApplication>('/fair-applications', { fairId }),
      );
      this._applications.set([...this._applications(), application]);
      return { error: null, conflict: false };
    } catch (err: unknown) {
      const error = toApiError(err);
      return { error, conflict: error.status === 409 };
    } finally {
      this._busyId.set(null);
    }
  }

  /**
   * Staff approve or reject.
   *
   * Not optimistic either. Approving adds the employer to the fair, which
   * makes them assignable to a booth — showing that as done before the server
   * agreed would put a company on a floor plan it may not be on.
   */
  async decide(
    id: string,
    status: Extract<ApplicationStatus, 'approved' | 'rejected'>,
    rejectionReason: string | null = null,
  ): Promise<ApiError | null> {
    this._busyId.set(id);

    try {
      const decided = await firstValueFrom(
        this.api.patch<FairApplication>(`/fair-applications/${id}`, { status, rejectionReason }),
      );
      this._applications.set(
        this._applications().map((entry) => (entry.id === decided.id ? decided : entry)),
      );
      return null;
    } catch (err: unknown) {
      return toApiError(err);
    } finally {
      this._busyId.set(null);
    }
  }

  /** The employer's own application for a fair, whatever its state. */
  applicationFor(fairId: string): FairApplication | null {
    const forFair = this._applications().filter((entry) => entry.fairId === fairId);
    // A rejected application can be resubmitted, so a later pending or
    // approved row is the one that counts.
    return (
      forFair.find((entry) => entry.status !== 'rejected') ?? forFair.at(-1) ?? null
    );
  }
}
