import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Candidate, CandidateProfileInput, Fair, FairRegistration } from '../../core/models';
import { isOpenForSignup } from '../../core/fairs/fair-timing';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RegisterResult {
  readonly error: ApiError | null;
  /** True when they were already registered — a normal outcome, not a failure. */
  readonly duplicate: boolean;
}

/**
 * The job seeker's own view of the portal: which fairs are open, which they
 * have registered for, and their own profile.
 *
 * One store for both pages because they read the same three collections and
 * every write to one changes the other.
 */
@Injectable({ providedIn: 'root' })
export class JobSeekerStore {
  private readonly api = inject(ApiService);

  private readonly _fairs = signal<readonly Fair[]>([]);
  private readonly _registrations = signal<readonly FairRegistration[]>([]);
  private readonly _profile = signal<Candidate | null>(null);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _busyFairId = signal<string | null>(null);
  private readonly _saving = signal(false);

  readonly fairs = this._fairs.asReadonly();
  readonly registrations = this._registrations.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busyFairId = this._busyFairId.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  /**
   * Only fairs still taking registrations are worth showing someone — and a
   * fair whose dates have passed is not one, whatever its status still says.
   */
  readonly openFairs = computed(() => this._fairs().filter((fair) => isOpenForSignup(fair)));

  readonly registeredFairIds = computed(
    () => new Set(this._registrations().map((entry) => entry.fairId)),
  );

  readonly registeredCount = computed(() => this._registrations().length);

  readonly hasNoOpenFairs = computed(
    () => this._status() === 'success' && this.openFairs().length === 0,
  );

  /**
   * Loads everything the portal needs.
   *
   * All three in parallel and one status between them: a page showing fairs
   * without knowing which are already registered would render every button in
   * the wrong state for a moment.
   */
  async load(candidateId: string | null): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const [fairs, registrations, profile] = await Promise.all([
        firstValueFrom(this.api.getList<Fair>('/fairs')),
        firstValueFrom(this.api.getList<FairRegistration>('/fair-registrations')),
        candidateId
          ? firstValueFrom(this.api.get<Candidate>(`/candidates/${candidateId}`))
          : Promise.resolve(null),
      ]);

      this._fairs.set(fairs.data);
      this._registrations.set(registrations.data);
      this._profile.set(profile);
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * Registers for a fair.
   *
   * Not optimistic. Registering is a consent event, and showing someone as
   * registered before the server agreed would be claiming they consented to
   * something that did not happen.
   *
   * `consent` is passed explicitly rather than defaulted so the call site has
   * to have asked.
   */
  async register(fairId: string, consent: boolean): Promise<RegisterResult> {
    this._busyFairId.set(fairId);

    try {
      const created = await firstValueFrom(
        this.api.post<FairRegistration>('/fair-registrations', { fairId, consent }),
      );
      this._registrations.set([...this._registrations(), created]);
      return { error: null, duplicate: false };
    } catch (err: unknown) {
      const error = toApiError(err);
      return { error, duplicate: error.status === 409 };
    } finally {
      this._busyFairId.set(null);
    }
  }

  /** Withdraws, optimistically, restoring the row if the request fails. */
  async withdraw(fairId: string): Promise<ApiError | null> {
    const snapshot = this._registrations();
    const entry = snapshot.find((row) => row.fairId === fairId);
    if (!entry) {
      return null;
    }

    this._busyFairId.set(fairId);
    this._registrations.set(snapshot.filter((row) => row.id !== entry.id));

    try {
      await firstValueFrom(this.api.delete(`/fair-registrations/${entry.id}`));
      return null;
    } catch (err: unknown) {
      this._registrations.set(snapshot);
      return toApiError(err);
    } finally {
      this._busyFairId.set(null);
    }
  }

  registrationFor(fairId: string): FairRegistration | null {
    return this._registrations().find((entry) => entry.fairId === fairId) ?? null;
  }

  /**
   * Saves the profile.
   *
   * Not optimistic: this is what employers read, and the 422 path is a real
   * one here — the form has nine fields and the API validates all of them, so
   * the caller needs the error back to attach to the right control rather
   * than a screen that already claims to have saved.
   */
  async saveProfile(input: CandidateProfileInput): Promise<ApiError | null> {
    const id = this._profile()?.id;
    if (!id) {
      return null;
    }

    this._saving.set(true);

    try {
      const saved = await firstValueFrom(this.api.patch<Candidate>(`/candidates/${id}`, input));
      this._profile.set(saved);
      return null;
    } catch (err: unknown) {
      return toApiError(err);
    } finally {
      this._saving.set(false);
    }
  }
}
