import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Dashboard KPI: muted caption label, large display number, then an optional
 * delta with direction (docs/03 "KPI card").
 *
 * The delta shows an arrow icon as well as colour, so the direction survives
 * for anyone who cannot distinguish green from red.
 */
@Component({
  selector: 'app-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, PercentPipe, MatIconModule],
  // block + h-full so every card in the KPI grid is the same height. Without
  // it the host sizes to content and a card with no delta line ends short,
  // leaving the row's bottom edge ragged (docs/07 UX-7).
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-1 rounded-md border border-border bg-raised p-4"
    >
      <p class="kpi__label fo-caption m-0">{{ label() }}</p>
      <p
        class="kpi__value fo-tabular m-0 font-brand text-display font-bold tracking-tight text-ink"
      >
        @if (prefix(); as text) {
          <span class="text-h2 font-semibold">{{ text }}</span>
        }{{ value() | number: format() }}@if (suffix(); as text) {
          <span class="text-h2 font-semibold">{{ text }}</span>
        }
      </p>
      @if (deltaPct(); as delta) {
        <!-- mt-auto pins the delta to the bottom, so deltas line up across the
             row even when a value wraps. -->
        <p
          class="kpi__delta fo-caption m-0 mt-auto flex items-center gap-1"
          [style.color]="deltaColor()"
        >
          <mat-icon class="kpi__delta-icon" aria-hidden="true">{{ deltaIcon() }}</mat-icon>
          {{ delta | percent: '1.0-1' }} {{ deltaCaption() }}
        </p>
      }
    </article>
  `,
  styles: `
    // Material sizes mat-icon from its own tokens, so this is not something a
    // utility can do (docs/07 T-D3).
    .kpi__delta-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  /** e.g. `RM ` for money. */
  readonly prefix = input<string | null>(null);
  readonly suffix = input<string | null>(null);
  /** `DecimalPipe` digits spec. */
  readonly format = input<string>('1.0-0');
  /** -1..1, or `null` when there is no baseline. */
  readonly deltaPct = input<number | null>(null);
  /** Text after the percentage, e.g. "vs last fair". */
  readonly deltaCaption = input<string>('vs previous');
  /**
   * False when a rise is bad news, so the colour follows meaning rather than
   * arithmetic sign.
   */
  readonly higherIsBetter = input<boolean>(true);

  protected readonly deltaIcon = computed(() =>
    (this.deltaPct() ?? 0) >= 0 ? 'arrow_upward' : 'arrow_downward',
  );

  protected readonly deltaColor = computed(() => {
    const delta = this.deltaPct();
    if (delta === null || delta === 0) {
      return 'var(--fo-text-muted)';
    }
    const good = delta > 0 === this.higherIsBetter();
    return good ? 'var(--fo-success)' : 'var(--fo-error)';
  });
}
