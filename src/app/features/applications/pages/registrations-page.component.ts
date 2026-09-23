import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import type { FairApplication } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ApplicationsStore } from '../applications.store';
import { RegistrationDecisions } from '../registration-decisions.service';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';
import { Router, RouterOutlet } from '@angular/router';

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
    BusyLabelComponent,
    RouterOutlet,
  ],
  templateUrl: './registrations-page.component.html',
  styleUrl: './registrations-page.component.scss',
})
export default class RegistrationsPageComponent {
  private readonly router = inject(Router);
  private readonly decisions = inject(RegistrationDecisions);

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

  /** Both live in a service, so the card and the detail modal share them. */
  protected approve(application: FairApplication): Promise<void> {
    return this.decisions.approve(application);
  }

  protected reject(application: FairApplication): Promise<void> {
    return this.decisions.reject(application);
  }

  /** Opens the full detail. A child route, so the URL carries the id. */
  protected openDetail(application: FairApplication): void {
    void this.router.navigate(['/staff/registrations', application.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected retry(): void {
    void this.store.load();
  }
}
