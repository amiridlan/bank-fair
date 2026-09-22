import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import type { Fair } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';
import { ConsentDialogComponent } from '../components/consent.dialog';
import { JobSeekerStore } from '../job-seeker.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';

type FairFilter = 'all' | 'registered';

/**
 * Browse open fairs and register for them (docs/08 S2).
 *
 * One page rather than a list and a separate "my fairs": both would show the
 * same fairs with the same cards, and a filter says which is which without
 * making someone hold two screens in their head.
 */
@Component({
  selector: 'app-seeker-fairs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatusChipComponent,
  
    BusyLabelComponent,
  ],
  templateUrl: './seeker-fairs-page.component.html',
  styleUrl: './seeker-fairs-page.component.scss',
})
export default class SeekerFairsPageComponent {
  private readonly auth = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(JobSeekerStore);
  protected readonly filter = signal<FairFilter>('all');

  protected readonly visibleFairs = computed<readonly Fair[]>(() => {
    const fairs = this.store.openFairs();
    if (this.filter() === 'all') {
      return fairs;
    }
    return fairs.filter((fair) => this.store.registeredFairIds().has(fair.id));
  });

  protected readonly isEmptyForFilter = computed(
    () => !this.store.isLoading() && !this.store.hasError() && this.visibleFairs().length === 0,
  );

  constructor() {
    effect(() => void this.store.load(this.auth.candidateId()));
  }

  protected isRegistered(fairId: string): boolean {
    return this.store.registeredFairIds().has(fairId);
  }

  protected isMultiDay(fair: Fair): boolean {
    return fair.startDate.slice(0, 10) !== fair.endDate.slice(0, 10);
  }

  /** Consent is collected before the request, never assumed by it. */
  protected async register(fair: Fair): Promise<void> {
    const agreed = await firstValueFrom(
      this.dialog
        .open(ConsentDialogComponent, { data: { fairName: fair.name }, width: '520px', maxWidth: '95vw' })
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
  protected async withdraw(fair: Fair): Promise<void> {
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

  protected retry(): void {
    void this.store.load(this.auth.candidateId());
  }
}
