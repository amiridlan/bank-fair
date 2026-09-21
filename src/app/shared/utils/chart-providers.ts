import type { Provider } from '@angular/core';
import { BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { provideCharts } from 'ng2-charts';

/**
 * chart.js registration, provided by the chart components rather than at the
 * application root.
 *
 * `provideCharts` in `app.config.ts` would drag chart.js into the initial
 * bundle — measured at +217kB — which defeats the `@defer` blocks the charts
 * sit behind. `BaseChartDirective` injects its configuration with
 * `optional: true` and resolves it through the element injector, so a
 * component-level provider works and keeps chart.js inside the deferred chunk.
 *
 * Only the pieces a bar chart needs are registered; adding a line or pie chart
 * later means adding its controller and element here.
 */
export const CHART_PROVIDERS: Provider[] = [
  provideCharts({
    registerables: [BarController, BarElement, CategoryScale, LinearScale, Tooltip],
  }),
];
