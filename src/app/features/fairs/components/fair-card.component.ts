import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import type { Fair } from '../../../core/models';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';

/**
 * One fair in the list. Presentational: it takes a `Fair` and links onward,
 * and injects nothing.
 */
@Component({
  selector: 'app-fair-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, PercentPipe, MatIconModule, RouterLink, StatusChipComponent],
  template: `
    <article class="card">
      <div class="card__head">
        <h2 class="card__title">
          <a class="card__link" [routerLink]="['/staff/fairs', fair().id]">{{ fair().name }}</a>
        </h2>
        <app-status-chip kind="fair" [status]="fair().status" />
      </div>

      <p class="card__meta fo-caption">
        <mat-icon class="card__icon" aria-hidden="true">place</mat-icon>
        {{ fair().venue }}, {{ fair().city }}
      </p>

      <p class="card__meta fo-caption">
        <mat-icon class="card__icon" aria-hidden="true">calendar_today</mat-icon>
        <!-- Malaysian format: DD/MM/YYYY. -->
        {{ fair().startDate | date: 'dd/MM/yyyy' }}
        @if (isMultiDay()) {
          – {{ fair().endDate | date: 'dd/MM/yyyy' }}
        }
      </p>

      <dl class="card__stats">
        <div class="card__stat">
          <dt class="fo-caption">Booths</dt>
          <dd class="fo-tabular">
            {{ fair().boothAssigned }}/{{ fair().boothTotal }}
            <span class="fo-caption">({{ fillRate() | percent: '1.0-0' }})</span>
          </dd>
        </div>
        <div class="card__stat">
          <dt class="fo-caption">Registrations</dt>
          <dd class="fo-tabular">{{ fair().registrations | number }}</dd>
        </div>
        <div class="card__stat">
          <dt class="fo-caption">Check-ins</dt>
          <dd class="fo-tabular">{{ fair().checkIns | number }}</dd>
        </div>
      </dl>

      <!-- Fill is shown as text above; this bar is decorative reinforcement. -->
      <div class="card__bar" aria-hidden="true">
        <span class="card__bar-fill" [style.width.%]="fillRate() * 100"></span>
      </div>
    </article>
  `,
  styleUrl: './fair-card.component.scss',
})
export class FairCardComponent {
  readonly fair = input.required<Fair>();

  protected readonly fillRate = computed(() => {
    const { boothAssigned, boothTotal } = this.fair();
    return boothTotal > 0 ? boothAssigned / boothTotal : 0;
  });

  protected readonly isMultiDay = computed(
    () => this.fair().startDate.slice(0, 10) !== this.fair().endDate.slice(0, 10),
  );
}
