import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { ApiService } from '../http/api.service';
import { DemoSettingsService } from '../mock-api/demo-settings.service';

/**
 * Switches the demo identity from the top bar.
 *
 * DEMO ONLY. This is not a sign-in: it swaps a client-side signal. See the
 * warning in `auth.store.ts`.
 */
@Component({
  selector: 'app-role-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule],
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

      <mat-divider />
      <div class="switcher__caption fo-caption" role="presentation">Demo data</div>

      <button
        mat-menu-item
        type="button"
        [attr.aria-pressed]="demoSettings.simulateErrors()"
        (click)="demoSettings.toggleSimulatedErrors()"
      >
        <mat-icon aria-hidden="true">
          {{ demoSettings.simulateErrors() ? 'toggle_on' : 'toggle_off' }}
        </mat-icon>
        <span>Simulate errors</span>
        <span class="switcher__role fo-caption">
          {{ demoSettings.simulateErrors() ? 'On' : 'Off' }}
        </span>
      </button>

      <button mat-menu-item type="button" [disabled]="resetting()" (click)="resetDemoData()">
        <mat-icon aria-hidden="true">restart_alt</mat-icon>
        <span>{{ resetting() ? 'Resetting…' : 'Reset demo data' }}</span>
      </button>
    </mat-menu>
  `,
  styleUrl: './role-switcher.component.scss',
})
export class RoleSwitcherComponent {
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly auth = inject(AuthStore);
  protected readonly demoSettings = inject(DemoSettingsService);
  protected readonly resetting = signal(false);

  protected roleLabel(role: string): string {
    return role === 'staff' ? 'Staff' : 'Hiring manager';
  }

  /**
   * Reseeds the mock database and reloads, which is the simplest way to clear
   * every store's cached signals at once. Mock-only; the endpoint does not
   * exist in Laravel.
   */
  protected async resetDemoData(): Promise<void> {
    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.postVoid('/demo/reset'));
      window.location.reload();
    } catch {
      // errorInterceptor already showed a snackbar for the failure itself;
      // this says what it means for the action the user took.
      this.snackBar.open('Could not reset the demo data.', 'Dismiss', { duration: 6000 });
      this.resetting.set(false);
    }
  }
}
