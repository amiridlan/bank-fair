import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import type { AuditAction, AuditEntity, AuditEntry } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { AuditStore, type EntityFilter } from '../audit.store';

/** Exhaustive, so a new action cannot render as a raw slug. */
const ACTION_LABEL: Readonly<Record<AuditAction, string>> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  approved: 'Approved',
  rejected: 'Turned down',
  assigned: 'Assigned',
  cleared: 'Cleared',
  booked: 'Booked',
  cancelled: 'Cancelled',
  reset: 'Reset',
};

const ENTITY_LABEL: Readonly<Record<AuditEntity, string>> = {
  employer: 'Employer',
  candidate: 'Candidate',
  booth: 'Booth',
  shortlist: 'Shortlist',
  'fair-application': 'Fair application',
  'fair-registration': 'Fair registration',
  'interview-slot': 'Interview slot',
  demo: 'Demo data',
};

/** Field names as people read them, rather than as the model spells them. */
const FIELD_LABEL: Readonly<Record<string, string>> = {
  boothPackage: 'booth package',
  candidateId: 'candidate',
  contactEmail: 'contact email',
  contactName: 'contact name',
  contactPhone: 'contact phone',
  dealValueMyr: 'deal value',
  employerId: 'employer',
  fairIds: 'fairs',
  fieldOfStudy: 'field of study',
  fullName: 'full name',
  graduationYear: 'graduation year',
  lostReason: 'lost reason',
  rejectionReason: 'reason',
};

/**
 * Who changed what, newest first (docs/09 A3).
 *
 * Read-only, and says so: nothing in the app writes here except as a
 * consequence of another request, which is what makes it worth reading.
 */
@Component({
  selector: 'app-activity-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.scss',
})
export class ActivityLogComponent {
  protected readonly store = inject(AuditStore);

  protected readonly entityOptions = computed<readonly { value: EntityFilter; label: string }[]>(
    () => [
      { value: 'all', label: 'Everything' },
      ...this.store
        .availableEntities()
        .map((entity) => ({ value: entity as EntityFilter, label: ENTITY_LABEL[entity] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
  );

  constructor() {
    void this.store.load();
  }

  protected summary(entry: AuditEntry): string {
    return `${ACTION_LABEL[entry.action]} · ${ENTITY_LABEL[entry.entity]}`;
  }

  protected fieldLabel(field: string): string {
    return FIELD_LABEL[field] ?? field;
  }

  /** "lead → proposal", or "set"/"cleared" when one side is empty. */
  protected changeText(from: string | null, to: string | null): string {
    if (from === null && to !== null) {
      return `set to ${to}`;
    }
    if (from !== null && to === null) {
      return `cleared (was ${from})`;
    }
    return `${from} → ${to}`;
  }

  protected onEntity(value: EntityFilter): void {
    void this.store.load(value);
  }

  protected refresh(): void {
    void this.store.load();
  }
}
