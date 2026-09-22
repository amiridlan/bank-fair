import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Booth } from '../../../core/models';

/**
 * One booth on the floor plan grid.
 *
 * A button rather than a div, so it is focusable and activates with Enter or
 * Space for free — the keyboard path in flow F1 depends on being able to
 * select a booth without a pointer.
 */
@Component({
  selector: 'app-booth-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="tile"
      [class.tile--empty]="!booth().employerId"
      [class.tile--selected]="selected()"
      [class.tile--pending]="pending()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ariaLabel()"
      (click)="activated.emit(booth())"
    >
      <span class="tile__code fo-mono">{{ booth().code }}</span>
      @if (pending()) {
        <span class="fo-spinner tile__spinner" aria-hidden="true"></span>
      }

      @if (booth().employerName; as name) {
        <span class="tile__name">{{ name }}</span>
      } @else {
        <span class="tile__free fo-caption">Free</span>
      }
    </button>
  `,
  styleUrl: './booth-tile.component.scss',
})
export class BoothTileComponent {
  readonly booth = input.required<Booth>();
  readonly selected = input<boolean>(false);
  readonly pending = input<boolean>(false);

  readonly activated = output<Booth>();

  protected readonly ariaLabel = computed(() => {
    const booth = this.booth();
    const occupancy = booth.employerName ? `assigned to ${booth.employerName}` : 'free';
    return `Booth ${booth.code}, ${booth.package}, ${occupancy}`;
  });
}
