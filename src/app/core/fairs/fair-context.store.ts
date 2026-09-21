import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { ApiService } from '../http/api.service';
import type { Fair } from '../models';

/**
 * The fairs the shell needs for its active-fair picker (decision D3).
 *
 * This lives in `core/` rather than reusing the fairs feature's store because
 * the shell is part of the frame, and `core/` must not depend on `features/`.
 * Only hiring managers see the picker, and only staff visit the fairs pages,
 * so in practice one or the other loads — not both.
 */
@Injectable({ providedIn: 'root' })
export class FairContextStore {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);

  private readonly _fairs = signal<readonly Fair[]>([]);
  private readonly _loaded = signal(false);

  readonly fairs = this._fairs.asReadonly();

  /** Fairs this hiring manager can act on: open or live, soonest first. */
  readonly selectableFairs = computed(() =>
    this._fairs()
      .filter((fair) => fair.status === 'open' || fair.status === 'live')
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  readonly activeFair = computed<Fair | null>(() => {
    const id = this.auth.activeFairId();
    return id ? (this._fairs().find((fair) => fair.id === id) ?? null) : null;
  });

  /**
   * Loads once per session, then seeds the active fair if none is set.
   *
   * A failure is deliberately quiet: the picker simply does not appear, and
   * the pages that need a fair show their own empty state. `errorInterceptor`
   * has already surfaced the failure itself.
   */
  async ensureLoaded(): Promise<void> {
    if (this._loaded()) {
      this.seedActiveFair();
      return;
    }

    try {
      const response = await firstValueFrom(this.api.getList<Fair>('/fairs'));
      this._fairs.set(response.data);
      this._loaded.set(true);
      this.seedActiveFair();
    } catch {
      this._loaded.set(false);
    }
  }

  /** Defaults to the soonest open or live fair, live first. */
  private seedActiveFair(): void {
    if (this.auth.activeFairId() !== null) {
      return;
    }

    const selectable = this.selectableFairs();
    const preferred = selectable.find((fair) => fair.status === 'live') ?? selectable[0];
    if (preferred) {
      this.auth.setActiveFair(preferred.id);
    }
  }
}
