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
   * Approving puts the employer on the fair, which other staff are working
   * from, so it asks first rather than being a one-click action in a list.
   *
   * It does NOT seat them: the floor plan offers only employers whose sales
   * stage has reached confirmed or paid, and an applicant is typically still
   * a lead. Advancing the pipeline off the back of an approval would move a
   * sales deal nobody agreed to move — and would put an employer who has not
   * paid onto a booth. The wording below says what approval actually did.
   */
  protected async approve(application: FairApplication): Promise<void> {
    const fair = this.fairName(application.fairId);
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Approve ${application.employerName}?`,
            message: `They will be attending ${fair}. Seating them on the floor plan still waits on the sales pipeline.`,
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
