import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import type { Fair } from '../models';

/**
 * Chooses the fair that shortlists and interview slots are scoped to (docs/04,
 * decision D3). Shown for hiring managers only.
 *
 * Presentational: it receives fairs and emits a choice, so the shell decides
 * where the list comes from. The shell feeds it from `FairContextStore`,
 * which also seeds the default — the soonest open or live fair, live first.
 *
 * It renders nothing when there are no selectable fairs, rather than showing
 * an empty dropdown.
 */
@Component({
  selector: 'app-active-fair-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    @if (fairs().length > 0) {
      <button
        matButton
        type="button"
        class="picker__trigger"
        [matMenuTriggerFor]="menu"
        [attr.aria-label]="'Change active fair. Current fair: ' + (selectedFairName() ?? 'none')"
      >
        <mat-icon aria-hidden="true">event</mat-icon>
        <span class="picker__name">{{ selectedFairName() ?? 'Choose a fair' }}</span>
        <mat-icon aria-hidden="true">arrow_drop_down</mat-icon>
      </button>

      <mat-menu #menu="matMenu">
        <div class="picker__caption fo-caption" role="presentation">Active fair</div>
        @for (fair of fairs(); track fair.id) {
          <button
            mat-menu-item
            type="button"
            [attr.aria-current]="fair.id === selectedFairId() ? 'true' : null"
            (click)="fairSelected.emit(fair.id)"
          >
            <mat-icon aria-hidden="true">
              {{ fair.id === selectedFairId() ? 'check' : 'event_note' }}
            </mat-icon>
            <span>{{ fair.name }}</span>
          </button>
        }
      </mat-menu>
    }
  `,
  styleUrl: './active-fair-picker.component.scss',
})
export class ActiveFairPickerComponent {
  readonly fairs = input<readonly Fair[]>([]);
  readonly selectedFairId = input<string | null>(null);

  readonly fairSelected = output<string>();

  protected selectedFairName(): string | null {
    return this.fairs().find((fair) => fair.id === this.selectedFairId())?.name ?? null;
  }
}
