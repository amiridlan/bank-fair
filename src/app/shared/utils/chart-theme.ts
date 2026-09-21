import type { ChartOptions } from 'chart.js';

/**
 * Chart styling derived from the design tokens.
 *
 * Colours are read from the CSS custom properties at runtime rather than
 * duplicated as hex values, so `_tokens.scss` stays the single source of truth
 * and a theme change reaches the charts for free.
 */

/** Falls back to a token's documented value when the DOM is unavailable (jsdom, SSR). */
const FALLBACKS: Readonly<Record<string, string>> = {
  '--fo-primary': '#0F766E',
  '--fo-border': '#E2E8F0',
  '--fo-text-muted': '#475569',
  '--fo-ink': '#14213D',
  '--fo-surface-raised': '#FFFFFF',
};

export function token(name: string): string {
  if (typeof document === 'undefined') {
    return FALLBACKS[name] ?? '';
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || (FALLBACKS[name] ?? '');
}

/**
 * Shared bar-chart options.
 *
 * Deliberate choices, following the visualization rules:
 * - **One series, one hue.** Identity comes from the axis labels, so no legend
 *   and no per-category colours. The status palette in docs/03 was measured and
 *   fails as a chart palette — its teal and green are only ΔE 8.6 apart for
 *   normal vision, and its red and green are 4.2 apart under deuteranopia, so
 *   colouring bars by stage would produce a chart people cannot read.
 * - **Recessive grid.** One axis of gridlines in the border token, no frame.
 * - **Rounded data ends** anchored to the baseline, and a thin bar cap so a
 *   two-bar chart does not render as two slabs.
 */
export function barChartOptions(horizontal: boolean, valueLabel: string): ChartOptions<'bar'> {
  const grid = token('--fo-border');
  const ink = token('--fo-ink');
  const muted = token('--fo-text-muted');

  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 250 },
    layout: { padding: { top: 4, right: 8 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: ink,
        titleFont: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 13 },
        bodyFont: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 13 },
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `${valueLabel}: ${context.formattedValue}`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        // Gridlines only across the value axis; the category axis needs none.
        grid: { display: horizontal, color: grid },
        ticks: { color: muted, font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 12 } },
      },
      y: {
        border: { display: false },
        grid: { display: !horizontal, color: grid },
        ticks: { color: muted, font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 12 } },
      },
    },
  };
}

/** Bar dataset styling: single hue, 4px rounded end, thin cap. */
export function barDataset(label: string, data: readonly number[]) {
  return {
    label,
    data: [...data],
    backgroundColor: token('--fo-primary'),
    hoverBackgroundColor: token('--fo-ink'),
    borderRadius: 4,
    borderSkipped: false as const,
    maxBarThickness: 36,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
