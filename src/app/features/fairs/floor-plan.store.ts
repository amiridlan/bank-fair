import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Booth, Employer } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AssignResult {
  readonly error: ApiError | null;
  /** The booth's previous occupant, so the caller can offer Undo. */
  readonly previousEmployerId: string | null;
  /** True when the booth was taken and `force` was not set. */
  readonly conflict: boolean;
}

@Injectable({ providedIn: 'root' })
export class FloorPlanStore {
  private readonly api = inject(ApiService);

  private readonly _booths = signal<readonly Booth[]>([]);
  private readonly _employers = signal<readonly Employer[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _fairId = signal<string | null>(null);
  private readonly _pendingBoothId = signal<string | null>(null);

  readonly booths = this._booths.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingBoothId = this._pendingBoothId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly hasNoBooths = computed(
    () => this._status() === 'success' && this._booths().length === 0,
  );

  /** Booths grouped into rows, so the grid renders in layout order. */
  readonly rows = computed<readonly (readonly Booth[])[]>(() => {
    const byRow = new Map<number, Booth[]>();
    for (const booth of this._booths()) {
      const row = byRow.get(booth.row) ?? [];
      row.push(booth);
      byRow.set(booth.row, row);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, booths]) => booths.sort((a, b) => a.col - b.col));
  });

  /**
   * Committed employers at this fair who do not yet hold a booth — the side
   * list that flow F1 drags from.
   */
  readonly unassignedEmployers = computed<readonly Employer[]>(() => {
    const fairId = this._fairId();
    if (!fairId) {
      return [];
    }
    const seated = new Set(
      this._booths()
        .map((booth) => booth.employerId)
        .filter((id): id is string => id !== null),
    );

    return this._employers()
      .filter(
        (employer) =>
          employer.fairIds.includes(fairId) &&
          (employer.stage === 'confirmed' || employer.stage === 'paid') &&
          !seated.has(employer.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly assignedCount = computed(
    () => this._booths().filter((booth) => booth.employerId !== null).length,
  );

  async load(fairId: string): Promise<void> {
    this._fairId.set(fairId);
    this._status.set('loading');
    this._error.set(null);

    try {
      // Both are needed before the page means anything, so a failure in
      // either is one failure for the view.
      const [booths, employers] = await Promise.all([
        firstValueFrom(this.api.getList<Booth>(`/fairs/${fairId}/booths`)),
        firstValueFrom(this.api.getList<Employer>('/employers')),
      ]);
      this._booths.set(booths.data);
      this._employers.set(employers.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Assigns an employer to a booth, optimistically.
   *
   * A 409 means the booth was already taken and `force` was not set — that is
   * a normal branch, not a failure: the caller shows a "Replace X with Y?"
   * confirmation and calls again with `force`. Any other error rolls the grid
   * back to its snapshot.
   */
  async assign(
    boothId: string,
    employerId: string | null,
    force = false,
  ): Promise<AssignResult> {
    const snapshot = this._booths();
    const booth = snapshot.find((entry) => entry.id === boothId);
    if (!booth) {
      return { error: null, previousEmployerId: null, conflict: false };
    }

    const previousEmployerId = booth.employerId;
    const employer = employerId
      ? (this._employers().find((entry) => entry.id === employerId) ?? null)
      : null;

    // An employer holds one booth per fair, so clear any booth they already
    // had — the same rule the API applies.
    this._booths.set(
      snapshot.map((entry) => {
        if (entry.id === boothId) {
          return { ...entry, employerId, employerName: employer?.name ?? null };
        }
        if (employerId !== null && entry.employerId === employerId) {
          return { ...entry, employerId: null, employerName: null };
        }
        return entry;
      }),
    );
    this._pendingBoothId.set(boothId);

    try {
      const updated = await firstValueFrom(
        this.api.patch<Booth>(`/booths/${boothId}`, { employerId, force }),
      );
      this._booths.set(
        this._booths().map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      return { error: null, previousEmployerId, conflict: false };
    } catch (err: unknown) {
      const error = toApiError(err);
      this._booths.set(snapshot);
      return { error, previousEmployerId, conflict: error.status === 409 };
    } finally {
      this._pendingBoothId.set(null);
    }
  }

  boothById(boothId: string): Booth | null {
    return this._booths().find((booth) => booth.id === boothId) ?? null;
  }

  employerById(employerId: string): Employer | null {
    return this._employers().find((employer) => employer.id === employerId) ?? null;
  }
}
