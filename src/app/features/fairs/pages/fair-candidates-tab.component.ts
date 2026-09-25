import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';

import type { Candidate } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { FairCandidatesStore } from '../fair-candidates.store';

/**
 * The Candidates tab of a fair: who has registered to attend (docs/11 V2).
 *
 * The counterpart to the Employers tab. Together they answer the two questions
 * a staff member has about a fair that is filling up — who is exhibiting, and
 * who is coming to meet them.
 *
 * Read-only, and contact details are masked. Staff need to see that people
 * registered and roughly who they are; they do not need three hundred email
 * addresses, and the API does not give them any (docs/11 V-D3).
 */
@Component({
  selector: 'app-fair-candidates-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatPaginatorModule,
    MatTableModule,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  templateUrl: './fair-candidates-tab.component.html',
  styleUrl: './fair-candidates-tab.component.scss',
})
export default class FairCandidatesTabComponent {
  protected readonly store = inject(FairCandidatesStore);

  readonly fairId = input.required<string>();

  // No contact column. Every value would be the same masked string, so it
  // would be 25 identical cells taking width from the fields staff actually
  // read. The rule is stated once above the table instead, with an example.
  protected readonly columns = [
    'fullName',
    'university',
    'fieldOfStudy',
    'graduationYear',
    'cgpa',
  ] as const;

  constructor() {
    effect(() => {
      void this.store.load(this.fairId());
    });
  }

  protected onPage(event: PageEvent): void {
    void this.store.load(this.fairId(), event.pageIndex + 1);
  }

  protected cgpaLabel(candidate: Candidate): string {
    return candidate.cgpa === null ? '—' : candidate.cgpa.toFixed(2);
  }

  protected retry(): void {
    void this.store.load(this.fairId());
  }
}
