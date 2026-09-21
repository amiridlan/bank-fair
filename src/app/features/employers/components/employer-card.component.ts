import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import type { Employer, EmployerStage } from '../../../core/models';
import { PIPELINE_STAGES, STAGE_LABEL } from '../employers.store';

/**
 * One employer on the pipeline board.
 *
 * The overflow menu is the keyboard alternative to dragging (flow F2) — every
 * drag action must be reachable without a pointer, so "Move to…" lists every
 * other stage.
 */
@Component({
  selector: 'app-employer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <article class="card" [class.card--pending]="pending()">
      <div class="card__head">
        <h3 class="card__name">{{ employer().name }}</h3>

        <button
          matIconButton
          type="button"
          class="card__menu"
          [matMenuTriggerFor]="menu"
          [attr.aria-label]="'Actions for ' + employer().name"
        >
          <mat-icon aria-hidden="true">more_vert</mat-icon>
        </button>

        <mat-menu #menu="matMenu">
          <button mat-menu-item type="button" (click)="edit.emit(employer())">
            <mat-icon aria-hidden="true">edit</mat-icon>
            <span>Edit employer</span>
          </button>
          <div class="card__menu-caption fo-caption" role="presentation">Move to</div>
          @for (stage of otherStages(); track stage) {
            <button mat-menu-item type="button" (click)="moveRequested.emit(stage)">
              <mat-icon aria-hidden="true">arrow_forward</mat-icon>
              <span>{{ label(stage) }}</span>
            </button>
          }
        </mat-menu>
      </div>

      <!-- The money reads immediately after the name. On a sales board it is
           the second thing you look for, and it used to sit at the foot in the
           same weight as the industry (docs/07 UX-8). -->
      @if (employer().dealValueMyr; as value) {
        <p class="card__value fo-tabular">
          {{ value | currency: 'MYR' : 'symbol-narrow' : '1.0-0' }}
        </p>
      } @else if (needsPackage()) {
        <!-- Only from Proposal onward, where a missing package is actually
             something to act on. Every Lead card carried "No package yet",
             which is the definitional state of a lead (docs/07 UX-9). -->
        <p class="card__value card__value--missing fo-caption">No package yet</p>
      }

      <p class="card__meta fo-caption">{{ employer().industry }}</p>
      <p class="card__meta fo-caption">{{ employer().contactName }}</p>

      @if (pending()) {
        <p class="card__meta fo-caption">Saving…</p>
      }

      @if (employer().lostReason; as reason) {
        <p class="card__lost fo-caption">{{ reason }}</p>
      }
    </article>
  `,
  styleUrl: './employer-card.component.scss',
})
export class EmployerCardComponent {
  readonly employer = input.required<Employer>();
  /** True while this card's move is in flight. */
  readonly pending = input<boolean>(false);

  readonly moveRequested = output<EmployerStage>();
  readonly edit = output<Employer>();

  protected readonly otherStages = computed(() =>
    PIPELINE_STAGES.filter((stage) => stage !== this.employer().stage),
  );

  /**
   * True when a missing booth package is worth flagging.
   *
   * A lead has not been pitched yet, so it has no package by definition. From
   * Proposal onward the gap is actionable — Paid is blocked without one.
   */
  protected readonly needsPackage = computed(
    () => this.employer().stage === 'proposal' || this.employer().stage === 'confirmed',
  );

  protected label(stage: EmployerStage): string {
    return STAGE_LABEL[stage];
  }
}
