import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import type { FairApplication } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ApplicationsStore } from '../applications.store';
import { RejectReasonDialogComponent } from '../components/reject-reason.dialog';

type QueueFilter = 'pending' | 'decided';

/**
 * The staff review queue for employer applications (docs/08 S3).
 *
 * Pending first and by default, because the queue exists to be emptied. The
 * decided list is a filter rather than a second page: same rows, same shape,
 * one of them already answered.
 */
@Component({
  selector: 'app-registrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './registrations-page.component.html',
  styleUrl: './registrations-page.component.scss',
})
export default class RegistrationsPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(ApplicationsStore);
  protected readonly filter = signal<QueueFilter>('pending');

  protected readonly visible = computed<readonly FairApplication[]>(() =>
    this.filter() === 'pending' ? this.store.pending() : this.store.decided(),
  );

  protected readonly isEmptyForFilter = computed(
    () => !this.store.isLoading() && !this.store.hasError() && this.visible().length === 0,
  );

  constructor() {
    void this.store.load();
  }

  protected fairName(fairId: string): string {
    return this.store.fairName()(fairId);
  }

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
  protected async approve(application: FairApplication): Promise<void> {
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

    await this.decide(application, 'approved', null, `${application.employerName} approved for ${fair}.`);
  }

  protected async reject(application: FairApplication): Promise<void> {
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

  protected retry(): void {
    void this.store.load();
  }
}
