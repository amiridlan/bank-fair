import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { AuditEntity, AuditEntry } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

/** Filter value for "no filter". A union member beats a magic empty string. */
export type EntityFilter = AuditEntity | 'all';

/**
 * The activity log, read by staff from Settings (docs/09 L1, L3).
 *
 * Read-only by design: entries are written by the mock engine as a
 * consequence of other requests, never by this store. Nothing in the app can
 * add to the log or edit it, which is the only property that makes it worth
 * reading.
 */
@Injectable({ providedIn: 'root' })
export class AuditStore {
  private readonly api = inject(ApiService);

  private readonly _entries = signal<readonly AuditEntry[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  private readonly _entity = signal<EntityFilter>('all');
  /**
   * Which kinds the log holds, learned from unfiltered loads only.
   *
   * Deriving this from the entries on screen collapsed the filter: choosing
   * "Employer" left "Employer" as the only thing in the list, so there was no
   * way to switch to another kind without going back through "Everything"
   * first. What is in view is not what exists.
   */
  private readonly _knownEntities = signal<readonly AuditEntity[]>([]);

  private readonly _recent = signal<readonly AuditEntry[]>([]);
  private readonly _recentStatus = signal<LoadStatus>('idle');

  readonly entries = this._entries.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly entity = this._entity.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');
  readonly isEmpty = computed(
    () => this._status() === 'success' && this._entries().length === 0,
  );

  /** The entity kinds the log holds, so the filter offers no dead options. */
  readonly availableEntities = this._knownEntities.asReadonly();

  /**
   * A second, always-unfiltered slice, read by the fair Overview tab.
   *
   * Deliberately separate from `entries`: this store is a root singleton, so
   * if the Overview called `load()` it would overwrite whichever filter the
   * Settings page was showing, and vice versa. Two readers with different
   * questions get two slices rather than fighting over one.
   */
  readonly recent = this._recent.asReadonly();
  readonly recentStatus = this._recentStatus.asReadonly();

  async load(entity: EntityFilter = this._entity()): Promise<void> {
    this._entity.set(entity);
    this._status.set('loading');
    this._error.set(null);

    const query = entity === 'all' ? '' : `?entity=${entity}`;

    try {
      const page = await firstValueFrom(
        this.api.getList<AuditEntry>(`/audit-entries${query}`),
      );
      this._entries.set(page.data);
      if (entity === 'all') {
        this._knownEntities.set([...new Set(page.data.map((row) => row.entity))]);
      }
      this._status.set('success');
    } catch (err: unknown) {
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }

  /**
   * The newest entries, whatever kind. Never touches the filtered slice, so a
   * fair Overview opening in one tab cannot change what Settings is showing.
   *
   * Failure is silent here on purpose: this feeds a secondary panel next to
   * the work the page is actually for, and an error banner over a fair's
   * overview because a demo audit log would not load is worse than the panel
   * simply having nothing to show.
   */
  async loadRecent(): Promise<void> {
    this._recentStatus.set('loading');

    try {
      const page = await firstValueFrom(this.api.getList<AuditEntry>('/audit-entries'));
      this._recent.set(page.data);
      this._recentStatus.set('success');
    } catch {
      this._recent.set([]);
      this._recentStatus.set('error');
    }
  }
}
