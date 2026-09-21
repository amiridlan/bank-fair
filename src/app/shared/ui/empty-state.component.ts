import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shown when a view loaded successfully but has nothing in it.
 *
 * Says what belongs here and offers the action that creates the first one —
 * never a bare "No data". No illustrations (docs/03).
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="empty">
      <mat-icon class="empty__icon" aria-hidden="true">{{ icon() }}</mat-icon>
      <h2>{{ heading() }}</h2>
      @if (message(); as text) {
        <p class="empty__message">{{ text }}</p>
      }
      @if (actionLabel(); as label) {
        <button matButton="filled" type="button" (click)="action.emit()">{{ label }}</button>
      }
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--fo-space-3);
      padding: var(--fo-space-7) var(--fo-space-4);
      text-align: center;
    }

    .empty__icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--fo-text-muted);
    }

    .empty__message {
      margin: 0;
      max-width: 42ch;
      color: var(--fo-text-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
  /** Omit to render no button. */
  readonly actionLabel = input<string | null>(null);

  readonly action = output<void>();
}
