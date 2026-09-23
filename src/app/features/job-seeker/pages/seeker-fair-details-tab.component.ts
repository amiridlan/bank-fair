import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { isOpenForSignup } from '../../../core/fairs/fair-timing';
import type { Fair, FairRegistration } from '../../../core/models';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';
import { FairRegistrationActions } from '../fair-registration-actions.service';
import { JobSeekerStore } from '../job-seeker.store';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';

/**
 * What this fair is, when and where it runs, and where the viewer stands with
 * it (docs/11 J2).
 *
 * Register and Withdraw go through `FairRegistrationActions`, the same service
 * the fair card uses, so consent is collected the same way in both places.
 */
@Component({
  selector: 'app-seeker-fair-details-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatIconModule, BusyLabelComponent],
  templateUrl: './seeker-fair-details-tab.component.html',
  styleUrl: './seeker-fair-details-tab.component.scss',
})
export default class SeekerFairDetailsTabComponent {
  private readonly actions = inject(FairRegistrationActions);

  protected readonly store = inject(SeekerFairDetailStore);
  protected readonly seeker = inject(JobSeekerStore);

  protected readonly registration = computed<FairRegistration | null>(() => {
    const fair = this.store.fair();
    return fair ? this.seeker.registrationFor(fair.id) : null;
  });

  protected readonly isRegistered = computed(() => this.registration() !== null);

  /**
   * Whether registering is still possible.
   *
   * Status alone is not enough: fair-06 is still marked open and finished a
   * week ago. Offering Register there would be an invitation nobody can
   * accept, which is the rule `isOpenForSignup` exists to hold.
   */
  protected readonly canRegister = computed(() => {
    const fair = this.store.fair();
    return fair ? isOpenForSignup(fair) : false;
  });

  protected readonly isMultiDay = computed(() => {
    const fair = this.store.fair();
    return fair ? fair.startDate.slice(0, 10) !== fair.endDate.slice(0, 10) : false;
  });

  protected readonly isBusy = computed(() => {
    const fair = this.store.fair();
    return fair ? this.seeker.busyFairId() === fair.id : false;
  });

  protected register(fair: Fair): Promise<void> {
    return this.actions.register(fair);
  }

  protected withdraw(fair: Fair): Promise<void> {
    return this.actions.withdraw(fair);
  }
}
