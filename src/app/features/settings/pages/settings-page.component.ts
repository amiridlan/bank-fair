import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { ApiService } from '../../../core/http/api.service';
import { DemoSettingsService } from '../../../core/mock-api/demo-settings.service';
import type { Role } from '../../../core/models';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { ActivityLogComponent } from '../components/activity-log.component';

/** Exhaustive over `Role`, so a new role cannot render as a blank. */
const ROLE_LABEL: Readonly<Record<Role, string>> = {
  staff: 'Staff',
  employer: 'Employer',
  job_seeker: 'Job seeker',
};

/**
 * One Settings page for all three roles (docs/09 L3).
 *
 * It holds the demo controls that used to live in the role-switcher menu,
 * where they were two clicks deep behind a control labelled "Switch demo
 * user" — not somewhere anyone looks for a reset.
 *
 * DEMO ONLY, and it says so on the page. Both switches here act on the mock
 * API; neither exists once a Laravel backend replaces it.
 */
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    ActivityLogComponent,
    BusyLabelComponent,
    PageHeaderComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export default class SettingsPageComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly auth = inject(AuthStore);
  protected readonly demoSettings = inject(DemoSettingsService);

  protected readonly resetting = signal(false);

  protected readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role()]);

  protected toggleSimulatedErrors(on: boolean): void {
    this.demoSettings.setSimulatedErrors(on);
    this.announcer.announce(
      on
        ? 'Simulated errors on. About one request in five will now fail.'
        : 'Simulated errors off.',
      'polite',
    );
  }

  /**
   * Reseeds the mock database and reloads, which is the simplest way to clear
   * every store's cached signals at once.
   *
   * It asks first, which the menu version did not: it throws away anything
   * done in this session, and there is no undo.
   */
  protected async resetDemoData(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Reset the demo data?',
            message:
              'Everything changed in this session — registrations, approvals, shortlists, bookings and profile edits — goes back to the seeded data. This cannot be undone.',
            confirmLabel: 'Reset demo data',
            cancelLabel: 'Keep my changes',
            destructive: true,
          },
        })
        .afterClosed(),
    );

    if (!confirmed) {
      return;
    }

    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.postVoid('/demo/reset'));
      // Reloads rather than re-fetching: every store holds its own cached
      // signals, and a reload is the one thing that clears all of them.
      window.location.reload();
    } catch {
      // errorInterceptor already showed a snackbar for the failure itself;
      // this says what it means for the action the user took.
      this.snackBar.open('Could not reset the demo data.', 'Dismiss', { duration: 6000 });
      this.resetting.set(false);
    }
  }
}
