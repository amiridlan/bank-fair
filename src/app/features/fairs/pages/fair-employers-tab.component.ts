import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import type { BoothPackage, Employer } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';
import { EmployersStore } from '../../employers/employers.store';

const PACKAGE_LABEL: Readonly<Record<BoothPackage, string>> = {
  standard: 'Standard',
  premium: 'Premium',
  platinum: 'Platinum',
};

/**
 * The Employers tab of a fair: who is in the pipeline for this one fair.
 *
 * The pipeline board at `/staff/employers` is the place to move an employer
 * between stages; this is the read-only per-fair slice of it, which is the
 * question "who is coming to this fair, and what is it worth?".
 */
@Component({
  selector: 'app-fair-employers-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatTableModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    StatusChipComponent,
  ],
  templateUrl: './fair-employers-tab.component.html',
  styleUrl: './fair-employers-tab.component.scss',
})
export default class FairEmployersTabComponent {
  protected readonly store = inject(EmployersStore);

  readonly fairId = input.required<string>();

  protected readonly columns = ['name', 'stage', 'package', 'value', 'contact'] as const;

  /** Every employer in the pipeline for this fair, won or lost. */
  protected readonly employers = computed<readonly Employer[]>(() => {
    const fairId = this.fairId();
    return this.store
      .employers()
      .filter((employer) => employer.fairIds.includes(fairId))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Lost deals are excluded: the figure is what this fair is worth, not what was pitched. */
  protected readonly committedValueMyr = computed(() =>
    this.employers()
      .filter((employer) => employer.stage !== 'lost')
      .reduce((sum, employer) => sum + (employer.dealValueMyr ?? 0), 0),
  );

  protected readonly confirmedCount = computed(
    () =>
      this.employers().filter(
        (employer) => employer.stage === 'confirmed' || employer.stage === 'paid',
      ).length,
  );

  protected readonly isEmpty = computed(
    () => this.store.status() === 'success' && this.employers().length === 0,
  );

  constructor() {
    effect(() => {
      // Referenced so a change of fair refetches rather than showing the
      // previous fair's slice of a stale list.
      this.fairId();
      void this.store.load();
    });
  }

  protected packageLabel(value: BoothPackage | null): string {
    return value ? PACKAGE_LABEL[value] : '—';
  }

  protected retry(): void {
    void this.store.load();
  }
}
