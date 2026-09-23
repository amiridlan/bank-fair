import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import type { Fair } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ConsentDialogComponent } from './components/consent.dialog';
import { JobSeekerStore } from './job-seeker.store';

/**
 * Registering for a fair and withdrawing from one, in one place.
 *
 * Both the fair card and the fair detail offer these, and neither is a plain
 * API call: registering collects consent first and withdrawing confirms first,
 * each has a 409 path, and both announce to a screen reader. Two copies would
 * drift, and the one that drifted would be the one nobody tested — the same
 * reasoning as `RegistrationDecisions` on the staff side.
 */
@Injectable({ providedIn: 'root' })
export class FairRegistrationActions {
  private readonly auth = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly store = inject(JobSeekerStore);

  /** Consent is collected before the request, never assumed by it. */
  async register(fair: Fair): Promise<void> {
    const agreed = await firstValueFrom(
      this.dialog
        .open(ConsentDialogComponent, {
          data: { fairName: fair.name },
          width: '520px',
          maxWidth: '95vw',
        })
        .afterClosed(),
    );

    if (agreed !== true) {
      return;
    }

    const result = await this.store.register(fair.id, true);

    if (result.duplicate) {
      // Another tab got there first. Resync rather than report a failure.
      await this.store.load(this.auth.candidateId());
      this.announcer.announce(`You are already registered for ${fair.name}.`, 'polite');
      return;
    }

    if (result.error) {
      this.announcer.announce(`Could not register for ${fair.name}.`, 'assertive');
      this.snackBar.open(`Couldn't register for ${fair.name}.`, 'Dismiss', { duration: 6000 });
      return;
    }

    this.announcer.announce(`Registered for ${fair.name}.`, 'polite');
    this.snackBar.open(`Registered for ${fair.name}.`, 'Dismiss', { duration: 5000 });
  }

  /**
   * Withdrawing removes a profile from employers who may already have seen it,
   * so it asks first rather than being a one-click undo.
   */
  async withdraw(fair: Fair): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Withdraw from ${fair.name}?`,
            message:
              'Your profile will no longer be visible to employers at this fair. You can register again while it is still open.',
            confirmLabel: 'Withdraw',
            cancelLabel: 'Stay registered',
          },
        })
        .afterClosed(),
    );

    if (!confirmed) {
      return;
    }

    const error = await this.store.withdraw(fair.id);

    if (error) {
      // The store has already put the registration back.
      this.announcer.announce(`Could not withdraw from ${fair.name}.`, 'assertive');
      this.snackBar.open(`Couldn't withdraw from ${fair.name}.`, 'Dismiss', { duration: 6000 });
      return;
    }

    this.announcer.announce(`Withdrawn from ${fair.name}.`, 'polite');
  }
}
