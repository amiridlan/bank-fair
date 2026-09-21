import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Employer, EmployerInput, EmployerStage } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

/** Pipeline columns, in the order the board shows them. */
export const PIPELINE_STAGES: readonly EmployerStage[] = [
  'lead',
  'proposal',
  'confirmed',
  'paid',
  'lost',
];

export const STAGE_LABEL: Readonly<Record<EmployerStage, string>> = {
  lead: 'Lead',
  proposal: 'Proposal',
  confirmed: 'Confirmed',
  paid: 'Paid',
  lost: 'Lost',
};

export interface StageMove {
  readonly employerId: string;
  readonly stage: EmployerStage;
  readonly lostReason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class EmployersStore {
  private readonly api = inject(ApiService);

  private readonly _employers = signal<readonly Employer[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _search = signal('');
  /** Set while a move is in flight, so the board can show it is saving. */
  private readonly _pendingId = signal<string | null>(null);

  readonly employers = this._employers.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();
  readonly pendingId = this._pendingId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(() => this._status() === 'success' && this._employers().length === 0);

  /** Employers grouped into board columns, filtered by the search term. */
  readonly byStage = computed<Readonly<Record<EmployerStage, readonly Employer[]>>>(() => {
    const term = this._search().toLowerCase().trim();
    const matching = term
      ? this._employers().filter((employer) =>
          `${employer.name} ${employer.industry} ${employer.contactName}`
            .toLowerCase()
            .includes(term),
        )
      : this._employers();

    const grouped = {} as Record<EmployerStage, Employer[]>;
    for (const stage of PIPELINE_STAGES) {
      grouped[stage] = [];
    }
    for (const employer of matching) {
      grouped[employer.stage].push(employer);
    }
    return grouped;
  });

  readonly totalValueMyr = computed(() =>
    this._employers()
      .filter((employer) => employer.stage !== 'lost')
      .reduce((sum, employer) => sum + (employer.dealValueMyr ?? 0), 0),
  );

  setSearch(term: string): void {
    this._search.set(term);
  }

  async load(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.api.getList<Employer>('/employers'));
      this._employers.set(response.data);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Moves an employer to another stage, optimistically.
   *
   * The card lands in its new column immediately, because waiting 300–800ms
   * for a drag to "take" feels broken. If the request fails the snapshot is
   * restored, so the board never shows a state the server rejected.
   *
   * Returns the error so the caller can offer Retry; it does not throw.
   */
  async moveStage(move: StageMove): Promise<ApiError | null> {
    const snapshot = this._employers();
    const current = snapshot.find((employer) => employer.id === move.employerId);
    if (!current || current.stage === move.stage) {
      return null;
    }

    this._employers.set(
      snapshot.map((employer) =>
        employer.id === move.employerId
          ? {
              ...employer,
              stage: move.stage,
              lostReason: move.stage === 'lost' ? (move.lostReason ?? null) : null,
            }
          : employer,
      ),
    );
    this._pendingId.set(move.employerId);

    try {
      const updated = await firstValueFrom(
        this.api.patch<Employer>(`/employers/${move.employerId}`, {
          stage: move.stage,
          ...(move.stage === 'lost' ? { lostReason: move.lostReason ?? null } : {}),
        }),
      );
      // Replace with the server's version: it also recomputes dealValueMyr
      // and updatedAt, which the optimistic guess did not.
      this.replace(updated);
      return null;
    } catch (err: unknown) {
      this._employers.set(snapshot);
      return toApiError(err);
    } finally {
      this._pendingId.set(null);
    }
  }

  async create(input: EmployerInput): Promise<ApiError | null> {
    try {
      const created = await firstValueFrom(this.api.post<Employer>('/employers', input));
      this._employers.set([created, ...this._employers()]);
      return null;
    } catch (err: unknown) {
      return toApiError(err);
    }
  }

  async update(id: string, input: Partial<EmployerInput>): Promise<ApiError | null> {
    try {
      this.replace(await firstValueFrom(this.api.patch<Employer>(`/employers/${id}`, input)));
      return null;
    } catch (err: unknown) {
      return toApiError(err);
    }
  }

  private replace(employer: Employer): void {
    this._employers.set(
      this._employers().map((existing) => (existing.id === employer.id ? employer : existing)),
    );
  }
}
