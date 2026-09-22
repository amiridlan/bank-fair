import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { Fair, FairApplication } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';
import { ApplicationsStore } from '../applications.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';

/**
 * An employer's view of the fairs they can attend, and where their
 * application stands (docs/08 S3).
 */
@Component({
  selector: 'app-employer-fairs-page',
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
  templateUrl: './employer-fairs-page.component.html',
  styleUrl: './employer-fairs-page.component.scss',
})
export default class EmployerFairsPageComponent {
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(ApplicationsStore);

  protected readonly hasNoOpenFairs = computed(
    () => !this.store.isLoading() && !this.store.hasError() && this.store.openFairs().length === 0,
  );

  constructor() {
    void this.store.load();
  }

  protected applicationFor(fairId: string): FairApplication | null {
    return this.store.applicationFor(fairId);
  }

  protected isMultiDay(fair: Fair): boolean {
    return fair.startDate.slice(0, 10) !== fair.endDate.slice(0, 10);
  }

  protected async apply(fair: Fair): Promise<void> {
    const result = await this.store.apply(fair.id);

    if (result.conflict) {
      // Someone else on the same account got there first.
      await this.store.load();
      this.announcer.announce(`You already have an application for ${fair.name}.`, 'polite');
      return;
    }

    if (result.error) {
      this.announcer.announce(`Could not apply for ${fair.name}.`, 'assertive');
      this.snackBar.open(`Couldn't apply for ${fair.name}.`, 'Dismiss', { duration: 6000 });
      return;
    }

    this.announcer.announce(`Applied for ${fair.name}. Awaiting review.`, 'polite');
    this.snackBar.open(`Applied for ${fair.name}. The organisers will review it.`, 'Dismiss', {
      duration: 6000,
    });
  }

  protected retry(): void {
    void this.store.load();
  }
}
