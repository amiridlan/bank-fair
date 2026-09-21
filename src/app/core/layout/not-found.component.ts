import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../auth/auth.store';

/** 404. Sends the visitor back to whichever home their role uses. */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="not-found">
      <mat-icon class="not-found__icon" aria-hidden="true">explore_off</mat-icon>
      <h1>Page not found</h1>
      <p class="not-found__message">
        That page does not exist, or it belongs to a section your role cannot open.
      </p>
      <a matButton="filled" [routerLink]="auth.homeRoute()">Go to {{ homeLabel() }}</a>
    </div>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--fo-space-3);
      min-height: 60vh;
      padding: var(--fo-space-6);
      text-align: center;
    }

    .not-found__icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--fo-text-muted);
    }

    .not-found__message {
      margin: 0;
      max-width: 44ch;
      color: var(--fo-text-muted);
    }
  `,
})
export default class NotFoundComponent {
  protected readonly auth = inject(AuthStore);

  protected homeLabel(): string {
    return this.auth.isStaff() ? 'the dashboard' : 'the talent pool';
  }
}
