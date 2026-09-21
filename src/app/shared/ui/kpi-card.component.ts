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
  template: `
    <article class="kpi">
      <p class="kpi__label fo-caption">{{ label() }}</p>
      <p class="kpi__value fo-tabular">
        @if (prefix(); as text) {
          <span class="kpi__affix">{{ text }}</span>
        }{{ value() | number: format() }}@if (suffix(); as text) {
          <span class="kpi__affix">{{ text }}</span>
        }
      </p>
      @if (deltaPct(); as delta) {
        <p class="kpi__delta fo-caption" [style.color]="deltaColor()">
          <mat-icon class="kpi__delta-icon" aria-hidden="true">{{ deltaIcon() }}</mat-icon>
          {{ delta | percent: '1.0-1' }} {{ deltaCaption() }}
        </p>
      }
    </article>
  `,
  styles: `
    .kpi {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-1);
      padding: var(--fo-space-4);
      border: 1px solid var(--fo-border);
      border-radius: var(--fo-radius-md);
      background: var(--fo-surface-raised);
    }

    .kpi__label {
      margin: 0;
    }

    .kpi__value {
      margin: 0;
      font-family: var(--fo-font-brand);
      font-size: var(--fo-display-size);
      font-weight: 700;
      line-height: var(--fo-display-line);
      letter-spacing: -0.02em;
      color: var(--fo-ink);
    }

    .kpi__affix {
      font-size: var(--fo-h2-size);
      font-weight: 600;
    }

    .kpi__delta {
      display: flex;
      align-items: center;
      gap: var(--fo-space-1);
      margin: 0;
    }

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
