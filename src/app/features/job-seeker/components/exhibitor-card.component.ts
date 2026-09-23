import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { FairExhibitor } from '../../../core/models';

/**
 * One employer on a fair's floor, as a visitor sees them.
 *
 * Takes a `FairExhibitor`, not an `Employer`, and that is deliberate: the
 * projection carries no commercial fields, so this component could not print
 * a deal value or a contact's phone number even by mistake (docs/11 J-D1).
 */
@Component({
  selector: 'app-exhibitor-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <article class="card">
      <div class="card__head">
        <div class="min-w-0">
          <h3 class="card__name">{{ exhibitor().name }}</h3>
          <p class="fo-caption m-0">{{ exhibitor().industry }} · {{ sizeLabel() }}</p>
        </div>
        <!-- The booth code is the one thing here used on the day, so it is
             the loudest element on the card rather than a footnote. -->
        <span class="booth fo-tabular" [attr.aria-label]="'Booth ' + exhibitor().boothCode">
          {{ exhibitor().boothCode }}
        </span>
      </div>

      <p class="openings fo-caption m-0">
        <mat-icon class="openings__icon" aria-hidden="true">work_outline</mat-icon>
        @if (exhibitor().openingCount === 1) {
          1 role advertised here
        } @else if (exhibitor().openingCount > 0) {
          {{ exhibitor().openingCount }} roles advertised here
        } @else {
          No roles listed yet — worth asking at the stand
        }
      </p>
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-3);
      height: 100%;
      padding: var(--fo-space-4);
      border: 1px solid var(--fo-border);
      border-radius: var(--fo-radius-md);
      background: var(--fo-surface-raised);
    }

    .card__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--fo-space-3);
    }

    .card__name {
      margin: 0;
      font-size: var(--fo-h2-size);
      line-height: var(--fo-h2-line);
      font-weight: 600;
      color: var(--fo-ink);
    }

    .booth {
      flex: none;
      padding: 2px var(--fo-space-2);
      border: 1px solid var(--fo-primary);
      border-radius: var(--fo-radius-sm);
      background: var(--fo-primary-subtle);
      color: var(--fo-primary);
      font-family: var(--fo-font-mono);
      font-size: var(--fo-mono-size);
      font-weight: 600;
      white-space: nowrap;
    }

    /* mt-auto keeps this on the bottom edge, so the line sits level across a
       row of cards whose names wrap to different heights (docs/10 finding 5). */
    .openings {
      display: flex;
      align-items: center;
      gap: var(--fo-space-1);
      margin-top: auto;
    }

    .openings__icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      flex: none;
    }
  `,
})
export class ExhibitorCardComponent {
  readonly exhibitor = input.required<FairExhibitor>();

  /** `1000+` reads oddly in a sentence; "1000+ staff" does not. */
  protected readonly sizeLabel = computed(() => `${this.exhibitor().companySize} staff`);
}
