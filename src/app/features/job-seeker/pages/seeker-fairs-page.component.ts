import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import type { Fair } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';
import { FairRegistrationActions } from '../fair-registration-actions.service';
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
    RouterLink,
    SkeletonComponent,
    StatusChipComponent,
    BusyLabelComponent,
  ],
  templateUrl: './seeker-fairs-page.component.html',
  styleUrl: './seeker-fairs-page.component.scss',
})
export default class SeekerFairsPageComponent {
  private readonly auth = inject(AuthStore);
  private readonly actions = inject(FairRegistrationActions);

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

  /** Both flows live in a service, so the card and the detail tab share them. */
  protected register(fair: Fair): Promise<void> {
    return this.actions.register(fair);
  }

  protected withdraw(fair: Fair): Promise<void> {
    return this.actions.withdraw(fair);
  }

  protected retry(): void {
    void this.store.load(this.auth.candidateId());
  }
}
