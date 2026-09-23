import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type ApiError, toApiError } from '../../core/http/api-error';
import { ApiService } from '../../core/http/api.service';
import type { Fair, FairExhibitor, FairJobOpening } from '../../core/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * One fair, as a job seeker sees it (docs/11 J2).
 *
 * Separate from `JobSeekerStore`, which holds the portal's own collections —
 * the open fairs, this person's registrations, their profile. This holds one
 * fair's detail, which is a different lifetime: it changes on every
 * navigation, and it must be able to load a fair that is closed or finished.
 * `JobSeekerStore.openFairs` deliberately excludes those, so the detail loads
 * the fair by id rather than looking it up there — otherwise a link to a past
 * fair would land on "not found".
 *
 * The exhibitor list comes from `/fairs/{id}/exhibitors`, never from
 * `/employers`: the latter is the sales pipeline and is staff-only
 * (docs/11 J-D1, J-D2).
 */
@Injectable({ providedIn: 'root' })
export class SeekerFairDetailStore {
  private readonly api = inject(ApiService);

  private readonly _fair = signal<Fair | null>(null);
  private readonly _exhibitors = signal<readonly FairExhibitor[]>([]);
  private readonly _openings = signal<readonly FairJobOpening[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<ApiError | null>(null);
  /** Which fair the current contents belong to, so a stale render is visible. */
  private readonly _loadedId = signal<string | null>(null);

  readonly fair = this._fair.asReadonly();
  readonly exhibitors = this._exhibitors.asReadonly();
  readonly openings = this._openings.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loadedId = this._loadedId.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  readonly exhibitorCount = computed(() => this._exhibitors().length);

  /** Total roles being recruited for across every stand at this fair. */
  readonly openingCount = computed(() =>
    this._exhibitors().reduce((sum, exhibitor) => sum + exhibitor.openingCount, 0),
  );

  /** Every distinct job family at this fair, for the filter. */
  readonly functions = computed(() =>
    [...new Set(this._openings().map((opening) => opening.jobFunction))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  /**
   * Both in parallel, under one status.
   *
   * A header that renders before the exhibitor count arrives would show "0
   * employers attending" and then correct itself, which reads as a fair nobody
   * signed up for.
   */
  async load(fairId: string): Promise<void> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const [fair, exhibitors, openings] = await Promise.all([
        firstValueFrom(this.api.get<Fair>(`/fairs/${fairId}`)),
        firstValueFrom(this.api.getList<FairExhibitor>(`/fairs/${fairId}/exhibitors`)),
        // The whole list in one request rather than a page at a time.
        //
        // The endpoint paginates, and should — a real backend cannot assume a
        // caller wants everything. But the Jobs tab filters by whether an
        // opening matches the viewer's own skills, and the server has no
        // notion of "my skills" here. Filtering a server-side page again on
        // the client would report counts for the page rather than the fair,
        // so all the filtering happens in one place, over one list. A fair
        // caps at 40 stands and the busiest in the seed carries 87 roles,
        // which is a fraction of the talent pool this app already renders.
        //
        // At a scale where this stopped being true, the skill match is what
        // would move to the server, not the pagination.
        firstValueFrom(
          this.api.getList<FairJobOpening>(`/fairs/${fairId}/job-openings`, {
            per_page: 500,
          }),
        ),
      ]);

      this._fair.set(fair);
      this._exhibitors.set(exhibitors.data);
      this._openings.set(openings.data);
      this._loadedId.set(fairId);
      this._status.set('success');
    } catch (err: unknown) {
      this._fair.set(null);
      this._exhibitors.set([]);
      this._openings.set([]);
      this._loadedId.set(null);
      this._error.set(toApiError(err));
      this._status.set('error');
    }
  }
}
