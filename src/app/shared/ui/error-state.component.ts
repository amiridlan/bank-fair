import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import type { ApiError } from '../../core/http/api-error';

/**
 * Shown when a view failed to load. Always offers Retry, and never shows a raw
 * status code — `ApiError.message` is already user-safe (docs/02 microcopy).
 *
 * `role="alert"` so assistive tech announces the failure when it replaces the
 * loading state.
 */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="error" role="alert">
      <mat-icon class="error__icon" aria-hidden="true">error_outline</mat-icon>
      <h2>{{ heading() }}</h2>
      <p class="error__message">{{ error()?.message ?? fallbackMessage }}</p>
      <button matButton="filled" type="button" (click)="retry.emit()">Retry</button>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--fo-space-3);
      padding: var(--fo-space-7) var(--fo-space-4);
      text-align: center;
    }

    .error__icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--fo-error);
    }

    .error__message {
      margin: 0;
      max-width: 42ch;
      color: var(--fo-text-muted);
    }
  `,
})
export class ErrorStateComponent {
  protected readonly fallbackMessage = 'Something went wrong. Try again.';

  readonly heading = input<string>("Couldn't load this");
  readonly error = input<ApiError | null>(null);

  readonly retry = output<void>();
}
