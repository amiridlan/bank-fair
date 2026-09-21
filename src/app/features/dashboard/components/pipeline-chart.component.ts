import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import type { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import type { EmployerStage, PipelineStagePoint } from '../../../core/models';
import { CHART_PROVIDERS } from '../../../shared/utils/chart-providers';
import { barChartOptions, barDataset } from '../../../shared/utils/chart-theme';

const STAGE_LABEL: Readonly<Record<EmployerStage, string>> = {
  lead: 'Lead',
  proposal: 'Proposal',
  confirmed: 'Confirmed',
  paid: 'Paid',
  lost: 'Lost',
};

/**
 * Deal value by pipeline stage.
 *
 * One series in a single hue rather than one colour per stage: the docs/03
 * status palette was measured against the categorical checks and fails — its
 * teal and green sit ΔE 8.6 apart for normal vision and its red and green 4.2
 * apart under deuteranopia. Stage identity comes from the axis labels, which
 * every reader gets regardless of colour vision.
 *
 * Lead and Lost are structurally zero — value appears at Proposal and a lost
 * deal carries none — and are shown rather than hidden, because the gap is
 * part of what the chart says.
 */
@Component({
  selector: 'app-pipeline-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective, CurrencyPipe],
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

    <table class="fo-sr-only">
      <caption>
        Pipeline value and employer count by stage
      </caption>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Employers</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        @for (point of points(); track point.stage) {
          <tr>
            <th scope="row">{{ label(point.stage) }}</th>
            <td>{{ point.count }}</td>
            <td>{{ point.valueMyr | currency: 'MYR' : 'symbol-narrow' : '1.0-0' }}</td>
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
export class PipelineChartComponent {
  readonly points = input.required<readonly PipelineStagePoint[]>();

  protected readonly options = barChartOptions(false, 'Value (RM)');

  protected readonly chartData = computed<ChartData<'bar'>>(() => ({
    labels: this.points().map((point) => STAGE_LABEL[point.stage]),
    datasets: [barDataset('Value (RM)', this.points().map((point) => point.valueMyr))],
  }));

  protected label(stage: EmployerStage): string {
    return STAGE_LABEL[stage];
  }

  protected readonly summaryText = computed(() =>
    this.points()
      .map((point) => `${STAGE_LABEL[point.stage]}: ${point.count} employers, RM ${point.valueMyr}`)
      .join('. '),
  );
}
