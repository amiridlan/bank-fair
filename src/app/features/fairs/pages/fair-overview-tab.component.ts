import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import type { AuditEntry, FairApplication } from '../../../core/models';
import { ApplicationsStore } from '../../applications/applications.store';
import { RegistrationDecisions } from '../../applications/registration-decisions.service';
import { AuditStore } from '../../settings/audit.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';
import { FairsStore } from '../fairs.store';

/** How many decisions the activity panel shows before it stops. */
const RECENT_LIMIT = 6;

/**
 * The Overview tab of a fair.
 *
 * It used to be a single strip of four figures, which left 68% of a 1000px
 * viewport blank while the Floor plan and Employers tabs either side of it
 * were full — an empty screen reads as broken, not as clean (docs/10 finding
 * 3). It now answers the question an organiser actually opens a fair with:
 * where does it stand, and what needs me?
 *
 * Three regions, in the order that question decomposes:
 *   1. the figures, with fill and check-in as bars rather than fractions
 *   2. the applications waiting on a decision, answerable without leaving
 *   3. the decisions already taken, so the tab shows the work as well as the
 *      backlog
 *
 * The parent shell has already loaded the fair, so this reads
 * `FairsStore.selected()` rather than fetching again.
 */
@Component({
  selector: 'app-fair-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    PercentPipe,
    MatButtonModule,
    MatIconModule,
    BusyLabelComponent,
  ],
  templateUrl: './fair-overview-tab.component.html',
  styleUrl: './fair-overview-tab.component.scss',
})
export default class FairOverviewTabComponent {
  private readonly router = inject(Router);
  private readonly decisions = inject(RegistrationDecisions);
  private readonly audit = inject(AuditStore);

  protected readonly store = inject(FairsStore);
  protected readonly applications = inject(ApplicationsStore);

  protected readonly fillRate = computed(() => {
    const fair = this.store.selected();
    if (!fair || fair.boothTotal === 0) {
      return 0;
    }
    return fair.boothAssigned / fair.boothTotal;
  });

  protected readonly checkInRate = computed(() => {
    const fair = this.store.selected();
    if (!fair || fair.registrations === 0) {
      return 0;
    }
    return fair.checkIns / fair.registrations;
  });

  protected readonly isMultiDay = computed(() => {
    const fair = this.store.selected();
    return fair ? fair.startDate.slice(0, 10) !== fair.endDate.slice(0, 10) : false;
  });

  /** Check-ins only mean something once people could have arrived. */
  protected readonly hasStarted = computed(() => {
    const fair = this.store.selected();
    return fair ? Date.parse(fair.startDate) <= Date.now() : false;
  });

  protected readonly boothsFree = computed(() => {
    const fair = this.store.selected();
    return fair ? fair.boothTotal - fair.boothAssigned : 0;
  });

  /** This fair's queue, not the whole app's. */
  protected readonly pending = computed<readonly FairApplication[]>(() => {
    const fair = this.store.selected();
    if (!fair) {
      return [];
    }
    return this.applications.pending().filter((application) => application.fairId === fair.id);
  });

  /**
   * Decisions taken on this fair's applications.
   *
   * Audit entries carry no fair id — they name the record that changed, not
   * the fair it belongs to — so the scoping is a join on this fair's
   * application ids rather than a query. That is also why the panel claims
   * only decisions: booth and employer entries cannot be attributed to a fair
   * from the log alone, and a panel headed "activity" that quietly showed one
   * kind would be worse than one that says which kind it shows.
   */
  protected readonly recentDecisions = computed<readonly AuditEntry[]>(() => {
    const fair = this.store.selected();
    if (!fair) {
      return [];
    }
    const ids = new Set(
      this.applications
        .applications()
        .filter((application) => application.fairId === fair.id)
        .map((application) => application.id),
    );
    return this.audit
      .recent()
      .filter((entry) => entry.entity === 'fair-application' && ids.has(entry.entityId))
      .slice(0, RECENT_LIMIT);
  });

  constructor() {
    // Both are root singletons and both no-op cheaply against the mock API.
    void this.applications.load();
    void this.audit.loadRecent();
  }

  protected approve(application: FairApplication): Promise<void> {
    return this.decisions.approve(application).then(() => void this.audit.loadRecent());
  }

  protected reject(application: FairApplication): Promise<void> {
    return this.decisions.reject(application).then(() => void this.audit.loadRecent());
  }

  /** The full record lives on the registrations queue, which owns that URL. */
  protected openDetail(application: FairApplication): void {
    void this.router.navigate(['/staff/registrations', application.id]);
  }

  protected goToFloorPlan(): void {
    const fair = this.store.selected();
    if (fair) {
      void this.router.navigate(['/staff/fairs', fair.id, 'floor-plan']);
    }
  }

  protected decisionLabel(entry: AuditEntry): string {
    return entry.action === 'approved' ? 'Approved' : 'Turned down';
  }
}
