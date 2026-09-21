import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DashboardStore } from '../dashboard.store';
import { BoothFillChartComponent } from '../components/booth-fill-chart.component';
import { PipelineChartComponent } from '../components/pipeline-chart.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

/**
 * Staff dashboard.
 *
 * Every widget renders its own loading, error and empty state. They share one
 * request (decision D4: `/dashboard/summary` returns the whole payload), so in
 * practice they fail together and any Retry refetches for all of them. Giving
 * each widget its own endpoint is what independent failure would take.
 *
 * Both charts sit in `@defer` blocks, so chart.js is fetched only once the
 * chart scrolls into view rather than loading with the page.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BoothFillChartComponent,
    PipelineChartComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    KpiCardComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './dashboard-page.component.html',
})
export default class DashboardPageComponent {
  protected readonly store = inject(DashboardStore);

  constructor() {
    void this.store.load();
  }

  protected retry(): void {
    void this.store.load();
  }
}
