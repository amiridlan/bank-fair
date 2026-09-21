import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';

import { FairsStore } from '../fairs.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';

/**
 * One fair, with tabs for Overview, Floor plan and Employers.
 *
 * `fairId` is bound straight from the route parameter, and the effect reloads
 * when it changes — so navigating between fairs works without an
 * `ActivatedRoute` subscription.
 */
@Component({
  selector: 'app-fair-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    PercentPipe,
    MatTabsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatusChipComponent,
  ],
  templateUrl: './fair-detail-page.component.html',
  styleUrl: './fair-detail-page.component.scss',
})
export default class FairDetailPageComponent {
  protected readonly store = inject(FairsStore);

  readonly fairId = input.required<string>();

  protected readonly fillRate = computed(() => {
    const fair = this.store.selected();
    if (!fair || fair.boothTotal === 0) {
      return 0;
    }
    return fair.boothAssigned / fair.boothTotal;
  });

  protected readonly checkInRate = computed(() => {
    const fair = this.store.selected();
    if (!fair || fair.registrations === 0) {
      return 0;
    }
    return fair.checkIns / fair.registrations;
  });

  protected readonly isMultiDay = computed(() => {
    const fair = this.store.selected();
    return fair ? fair.startDate.slice(0, 10) !== fair.endDate.slice(0, 10) : false;
  });

  constructor() {
    effect(() => {
      void this.store.loadOne(this.fairId());
    });
  }

  protected retry(): void {
    void this.store.loadOne(this.fairId());
  }
}
