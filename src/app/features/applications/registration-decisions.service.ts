import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import type { FairApplication } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ApplicationsStore } from './applications.store';
import { RejectReasonDialogComponent } from './components/reject-reason.dialog';

/**
 * Approving and turning down an application, in one place.
 *
 * Both the queue card and the detail modal offer these, and the rules are not
 * trivial — a confirmation naming two side effects, a required reason, a 409
 * when somebody else decided first. Two copies would drift, and the one that
 * drifted would be the one nobody tested.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationDecisions {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly store = inject(ApplicationsStore);

  /**
   * Approving puts the employer on the fair AND moves them to `confirmed` on
   * the sales pipeline, which is what makes them seatable on the floor plan.
   *
   * It therefore changes two shared views other staff are working from, so it
   * names both in the confirmation rather than being a one-click action in a
   * list. (Approval moving the pipeline is a demo decision, taken because a
   * demo should show the whole path; a real deal would be confirmed when it
   * is signed, not when an application is accepted.)
   */
  async approve(application: FairApplication): Promise<void> {
    const fair = this.fairName(application.fairId);
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Approve ${application.employerName}?`,
            message: `They will be attending ${fair}, move to Confirmed on the pipeline, and can then be assigned a booth on the floor plan.`,
            confirmLabel: 'Approve',
            cancelLabel: 'Not yet',
          },
        })
        .afterClosed(),
    );

    if (!confirmed) {
      return;
    }

    await this.decide(
      application,
      'approved',
      null,
      `${application.employerName} approved for ${fair}.`,
    );
  }

  async reject(application: FairApplication): Promise<void> {
    const fair = this.fairName(application.fairId);
    const reason = await firstValueFrom(
      this.dialog
        .open(RejectReasonDialogComponent, {
          data: { employerName: application.employerName, fairName: fair },
          maxWidth: '95vw',
        })
        .afterClosed(),
    );

    if (reason === null || reason === undefined) {
      return;
    }

    await this.decide(
      application,
      'rejected',
      reason,
      `${application.employerName} turned down for ${fair}.`,
    );
  }

  private fairName(fairId: string): string {
    return this.store.fairName()(fairId);
  }

  private async decide(
    application: FairApplication,
    status: 'approved' | 'rejected',
    rejectionReason: string | null,
    success: string,
  ): Promise<void> {
    const error = await this.store.decide(application.id, status, rejectionReason);

    if (error?.status === 409) {
      // Another organiser decided it while this one was reading. Resync: the
      // decision that landed first is the one that stands.
      await this.store.load();
      this.announcer.announce('That application was already decided by someone else.', 'assertive');
      this.snackBar.open('Someone else already decided that application.', 'Dismiss', {
        duration: 6000,
      });
      return;
    }

    if (error) {
      this.announcer.announce(`Could not update ${application.employerName}.`, 'assertive');
      this.snackBar.open(`Couldn't update ${application.employerName}.`, 'Dismiss', {
        duration: 6000,
      });
      return;
    }

    this.announcer.announce(success, 'polite');
    this.snackBar.open(success, 'Dismiss', { duration: 5000 });
  }
}
