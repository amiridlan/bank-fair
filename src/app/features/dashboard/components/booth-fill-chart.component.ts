import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import type { BoothFillPoint } from '../../../core/models';
import { CHART_PROVIDERS } from '../../../shared/utils/chart-providers';
import { barChartOptions, barDataset } from '../../../shared/utils/chart-theme';

/**
 * Booth fill per active fair.
 *
 * Horizontal bars because fair names are long — vertical would force the
 * labels to rotate. One series, so identity comes from the axis and no legend
 * is needed.
 */
@Component({
  selector: 'app-booth-fill-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  providers: [...CHART_PROVIDERS],
  template: `
    <div class="chart">
      <canvas
        baseChart
        type="bar"
        [data]="chartData()"
        [options]="options"
        [attr.aria-label]="summaryText()"
        role="img"
      ></canvas>
    </div>

    <!-- The canvas is opaque to assistive tech, so the same numbers are
         available as text. -->
    <table class="fo-sr-only">
      <caption>
        Booths assigned per fair
      </caption>
      <thead>
        <tr>
          <th scope="col">Fair</th>
          <th scope="col">Assigned</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        @for (point of points(); track point.fairId) {
          <tr>
            <th scope="row">{{ point.fairName }}</th>
            <td>{{ point.boothAssigned }}</td>
            <td>{{ point.boothTotal }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .chart {
      position: relative;
      height: 260px;
    }
  `,
})
export class BoothFillChartComponent {
  readonly points = input.required<readonly BoothFillPoint[]>();

  protected readonly options = barChartOptions(true, 'Booths assigned');

  protected readonly chartData = computed<ChartData<'bar'>>(() => ({
    labels: this.points().map((point) => point.fairName),
    datasets: [barDataset('Booths assigned', this.points().map((point) => point.boothAssigned))],
  }));

  protected readonly summaryText = computed(() =>
    this.points()
      .map((point) => `${point.fairName}: ${point.boothAssigned} of ${point.boothTotal} booths`)
      .join('. '),
  );
}
