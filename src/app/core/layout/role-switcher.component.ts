import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { AuthStore } from '../auth/auth.store';

/**
 * Switches the demo identity from the top bar.
 *
 * DEMO ONLY. This is not a sign-in: it swaps a client-side signal. See the
 * warning in `auth.store.ts`.
 */
@Component({
  selector: 'app-role-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button
      matButton
      type="button"
      class="switcher__trigger"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Switch demo user. Current user: ' + auth.user().name"
    >
      <mat-icon aria-hidden="true">account_circle</mat-icon>
      <span class="switcher__name">{{ auth.user().name }}</span>
      <mat-icon aria-hidden="true">arrow_drop_down</mat-icon>
    </button>

    <mat-menu #menu="matMenu">
      <div class="switcher__caption fo-caption" role="presentation">Demo users</div>
      @for (user of auth.availableUsers; track user.id) {
        <button
          mat-menu-item
          type="button"
          [attr.aria-current]="user.id === auth.user().id ? 'true' : null"
          (click)="auth.switchUser(user.id)"
        >
          <mat-icon aria-hidden="true">
            {{ user.id === auth.user().id ? 'check' : 'person_outline' }}
          </mat-icon>
          <span>{{ user.name }}</span>
          <span class="switcher__role fo-caption">{{ roleLabel(user.role) }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .switcher__trigger {
      color: var(--fo-text-on-ink);
    }

    .switcher__name {
      max-width: 14ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .switcher__caption {
      padding: var(--fo-space-2) var(--fo-space-4);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .switcher__role {
      margin-left: auto;
      padding-left: var(--fo-space-3);
    }

    @media (max-width: 767px) {
      .switcher__name {
        display: none;
      }
    }
  `,
})
export class RoleSwitcherComponent {
  protected readonly auth = inject(AuthStore);

  protected roleLabel(role: string): string {
    return role === 'staff' ? 'Staff' : 'Hiring manager';
  }
}
