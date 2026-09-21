import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { FairContextStore } from '../../../core/fairs/fair-context.store';
import type { InterviewSlot } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ShortlistStore } from '../../shortlist/shortlist.store';
import { BookSlotDialogComponent } from '../components/book-slot.dialog';
import { InterviewsStore } from '../interviews.store';

/**
 * Interview schedule for the active fair (flow F5).
 *
 * The fair comes from the top-bar picker rather than a second chooser here —
 * shortlists and slots must agree on which fair they mean, and one control
 * for both makes that impossible to get wrong.
 */
@Component({
  selector: 'app-interviews-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './interviews-page.component.html',
  styleUrl: './interviews-page.component.scss',
})
export default class InterviewsPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly auth = inject(AuthStore);

  protected readonly store = inject(InterviewsStore);
  protected readonly shortlist = inject(ShortlistStore);
  protected readonly fairContext = inject(FairContextStore);

  /** Shortlisted candidates who do not already hold a slot at this fair. */
  protected readonly availableCandidates = computed(() =>
    this.shortlist.entries().filter((entry) => !this.store.bookedCandidateIds().has(entry.candidateId)),
  );

  constructor() {
    effect(() => {
      const fairId = this.auth.activeFairId();
      void this.store.load(fairId);
      void this.shortlist.load(fairId);
    });
  }

  protected hasActiveFair(): boolean {
    return this.auth.activeFairId() !== null;
  }

  /** One entry point for a slot, whichever state it is in. */
  protected async onSlot(slot: InterviewSlot): Promise<void> {
    if (slot.candidateId) {
      await this.cancel(slot);
      return;
    }
    await this.book(slot);
  }

  private async book(slot: InterviewSlot): Promise<void> {
    const candidateId = await firstValueFrom(
      this.dialog
        .open(BookSlotDialogComponent, {
          data: {
            slot,
            available: this.availableCandidates(),
            shortlistEmpty: this.shortlist.count() === 0,
          },
        })
        .afterClosed(),
    );

    if (!candidateId) {
      return;
    }

    const result = await this.store.book(slot.id, candidateId);

    if (result.conflict) {
      // The store has already reloaded, so the grid shows what is really free.
      this.announcer.announce('That slot was just booked. Pick another.', 'assertive');
      this.snackBar.open(
        result.error?.message ?? 'That slot was just booked. Pick another.',
        'Dismiss',
        { duration: 6000 },
      );
      return;
    }

    if (result.error) {
      const snack = this.snackBar.open("Couldn't book that slot.", 'Retry', { duration: 8000 });
      snack.onAction().subscribe(() => void this.store.book(slot.id, candidateId));
      return;
    }

    const name = this.store.slotById(slot.id)?.candidateName ?? 'Candidate';
    this.announcer.announce(`${name} booked into the ${this.timeLabel(slot)} slot.`, 'polite');
  }

  private async cancel(slot: InterviewSlot): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Cancel this interview?',
            // Confirmations name the object (docs/02 microcopy).
            message: `Cancel the interview with ${slot.candidateName} at ${this.timeLabel(slot)}?`,
            confirmLabel: 'Cancel interview',
            cancelLabel: 'Keep it',
            destructive: true,
          },
        })
        .afterClosed(),
    );

    if (!confirmed) {
      return;
    }

    const name = slot.candidateName ?? 'Candidate';
    const error = await this.store.cancel(slot.id);

    if (error) {
      // The store has already put the booking back.
      const snack = this.snackBar.open(
        `Couldn't cancel the interview with ${name}.`,
        'Retry',
        { duration: 8000 },
      );
      snack.onAction().subscribe(() => void this.cancel(slot));
      return;
    }

    this.announcer.announce(`Interview with ${name} cancelled.`, 'polite');
    this.snackBar.open(`Interview with ${name} cancelled.`, 'Dismiss', { duration: 5000 });
  }

  protected retry(): void {
    void this.store.load(this.auth.activeFairId());
  }

  /**
   * `h:mm a` in Malaysian time, e.g. "10:20 am".
   *
   * The zone is explicit for the same reason as DATE_PIPE_DEFAULT_OPTIONS:
   * a slot's time is a fact about the fair, not about the viewer's location.
   */
  private timeLabel(slot: InterviewSlot): string {
    return new Date(slot.startTime).toLocaleTimeString('en-MY', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur',
    });
  }

  protected slotAriaLabel(slot: InterviewSlot): string {
    const time = this.timeLabel(slot);
    return slot.candidateName
      ? `${time}, booked with ${slot.candidateName}. Activate to cancel.`
      : `${time}, open. Activate to book.`;
  }
}
