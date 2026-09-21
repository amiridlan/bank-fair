import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';

import type { FairStatus } from '../../../core/models';
import { FairsStore } from '../fairs.store';
import { FairCardComponent } from '../components/fair-card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

const STATUSES: readonly FairStatus[] = ['draft', 'open', 'live', 'completed'];

/**
 * Fair list with status and city filters.
 *
 * Filters live in the URL query string, so a filtered view can be shared or
 * survive a refresh. `withComponentInputBinding()` feeds them straight into
 * the `input()`s below, and an effect reloads whenever they change.
 */
@Component({
  selector: 'app-fair-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    FairCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './fair-list-page.component.html',
  styleUrl: './fair-list-page.component.scss',
})
export default class FairListPageComponent {
  private readonly router = inject(Router);

  protected readonly store = inject(FairsStore);
  protected readonly statuses = STATUSES;

  /** Bound from `?status=` and `?city=`. */
  readonly status = input<string | undefined>(undefined);
  readonly city = input<string | undefined>(undefined);

  constructor() {
    effect(() => {
      const status = this.status();
      const city = this.city();

      void this.store.load({
        status: STATUSES.includes(status as FairStatus) ? (status as FairStatus) : null,
        city: city ?? null,
      });
    });
  }

  /** Writes the filter to the URL; the effect above does the reload. */
  protected setFilter(key: 'status' | 'city', value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [key]: value ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected retry(): void {
    void this.store.load();
  }
}
