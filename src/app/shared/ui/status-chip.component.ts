import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { EmployerStage, FairStatus } from '../../core/models';

interface StatusStyle {
  readonly label: string;
  readonly icon: string;
  /** Token used for the text, border and (tinted) background. */
  readonly colorVar: string;
  readonly subtleVar: string;
  /** Text colour override, for the accent whose contrast on white is 2.1:1. */
  readonly textVar?: string;
}

/**
 * Status is never conveyed by colour alone: every chip carries a label and an
 * icon too (docs/03, WCAG 1.4.1).
 *
 * `--fo-accent` is the one colour that is a background rather than text — at
 * 2.1:1 on white it fails as text, but pairs with `--fo-ink` at 7.1:1.
 */
const FAIR_STYLES: Readonly<Record<FairStatus, StatusStyle>> = {
  draft: {
    label: 'Draft',
    icon: 'edit_note',
    colorVar: '--fo-text-muted',
    subtleVar: '--fo-muted-subtle',
  },
  open: {
    label: 'Open',
    icon: 'event_available',
    colorVar: '--fo-primary',
    subtleVar: '--fo-primary-subtle',
  },
  live: {
    label: 'Live',
    icon: 'sensors',
    colorVar: '--fo-accent',
    subtleVar: '--fo-accent',
    textVar: '--fo-ink',
  },
  completed: {
    label: 'Completed',
    icon: 'task_alt',
    colorVar: '--fo-text-muted',
    subtleVar: '--fo-muted-subtle',
  },
};

const EMPLOYER_STYLES: Readonly<Record<EmployerStage, StatusStyle>> = {
  lead: { label: 'Lead', icon: 'person_search', colorVar: '--fo-info', subtleVar: '--fo-info-subtle' },
  proposal: {
    label: 'Proposal',
    icon: 'description',
    colorVar: '--fo-warning',
    subtleVar: '--fo-warning-subtle',
  },
  confirmed: {
    label: 'Confirmed',
    icon: 'handshake',
    colorVar: '--fo-primary',
    subtleVar: '--fo-primary-subtle',
  },
  paid: { label: 'Paid', icon: 'paid', colorVar: '--fo-success', subtleVar: '--fo-success-subtle' },
  lost: { label: 'Lost', icon: 'block', colorVar: '--fo-error', subtleVar: '--fo-error-subtle' },
};

const UNKNOWN: StatusStyle = {
  label: 'Unknown',
  icon: 'help_outline',
  colorVar: '--fo-text-muted',
  subtleVar: '--fo-muted-subtle',
};

@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span
      class="chip"
      [style.color]="'var(' + (style().textVar ?? style().colorVar) + ')'"
      [style.border-color]="'var(' + style().colorVar + ')'"
      [style.background-color]="'var(' + style().subtleVar + ')'"
    >
      <mat-icon class="chip__icon" aria-hidden="true">{{ style().icon }}</mat-icon>
      {{ style().label }}
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--fo-space-1);
      padding: 2px var(--fo-space-2);
      border: 1px solid;
      border-radius: var(--fo-radius-sm);
      font-size: var(--fo-caption-size);
      font-weight: 500;
      line-height: var(--fo-caption-line);
      white-space: nowrap;
    }

    .chip__icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
  `,
})
export class StatusChipComponent {
  readonly kind = input.required<'fair' | 'employer'>();
  readonly status = input.required<FairStatus | EmployerStage>();

  protected readonly style = computed<StatusStyle>(() => {
    const status = this.status();
    const styles: Readonly<Record<string, StatusStyle>> =
      this.kind() === 'fair' ? FAIR_STYLES : EMPLOYER_STYLES;
    return styles[status] ?? UNKNOWN;
  });
}
