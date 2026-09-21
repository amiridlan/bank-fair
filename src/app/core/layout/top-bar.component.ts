import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthStore } from '../auth/auth.store';
import type { Fair } from '../models';
import { ActiveFairPickerComponent } from './active-fair-picker.component';
import { RoleSwitcherComponent } from './role-switcher.component';

/**
 * Fixed 56px top bar: menu toggle (mobile only), wordmark, then the demo
 * controls. `--fo-ink` background with white text (docs/03).
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    ActiveFairPickerComponent,
    RoleSwitcherComponent,
  ],
  template: `
    <mat-toolbar class="bar">
      @if (showMenuButton()) {
        <button
          matIconButton
          type="button"
          class="bar__menu"
          aria-label="Open navigation menu"
          (click)="menuToggled.emit()"
        >
          <mat-icon aria-hidden="true">menu</mat-icon>
        </button>
      }

      <span class="bar__brand">BankFair</span>

      <span class="bar__spacer"></span>

      @if (auth.isHiringManager()) {
        <app-active-fair-picker
          [fairs]="fairs()"
          [selectedFairId]="auth.activeFairId()"
          (fairSelected)="auth.setActiveFair($event)"
        />
      }

      <app-role-switcher />
    </mat-toolbar>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      gap: var(--fo-space-2);
      height: var(--fo-topbar-height);
      min-height: var(--fo-topbar-height);
      padding: 0 var(--fo-space-4);
      background: var(--fo-ink);
      color: var(--fo-text-on-ink);
    }

    .bar__brand {
      font-family: var(--fo-font-brand);
      font-size: var(--fo-h2-size);
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .bar__spacer {
      flex: 1 1 auto;
    }

    .bar__menu {
      color: var(--fo-text-on-ink);
    }
  `,
})
export class TopBarComponent {
  protected readonly auth = inject(AuthStore);

  readonly showMenuButton = input<boolean>(false);
  /** Empty until Phase 3 wires this to `FairsStore`. */
  readonly fairs = input<readonly Fair[]>([]);

  readonly menuToggled = output<void>();
}
