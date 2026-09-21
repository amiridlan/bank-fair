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
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  protected readonly auth = inject(AuthStore);

  readonly showMenuButton = input<boolean>(false);
  /** Selectable fairs for the active-fair picker; empty hides it. */
  readonly fairs = input<readonly Fair[]>([]);

  readonly menuToggled = output<void>();
}
