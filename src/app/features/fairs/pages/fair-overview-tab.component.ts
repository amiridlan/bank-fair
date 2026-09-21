import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { FairsStore } from '../fairs.store';

/**
 * The Overview tab of a fair.
 *
 * The parent shell has already loaded the fair, so this reads
 * `FairsStore.selected()` rather than fetching again.
 */
@Component({
  selector: 'app-fair-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, PercentPipe],
  templateUrl: './fair-overview-tab.component.html',
  styleUrl: './fair-overview-tab.component.scss',
})
export default class FairOverviewTabComponent {
  protected readonly store = inject(FairsStore);

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
}
