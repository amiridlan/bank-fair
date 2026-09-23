import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import type {
  EmploymentType,
  ExperienceLevel,
  FairJobOpening,
} from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { JobOpeningCardComponent } from '../components/job-opening-card.component';
import { JobSeekerStore } from '../job-seeker.store';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';

type TypeFilter = EmploymentType | 'all';
type LevelFilter = ExperienceLevel | 'all';

/** Searchable text for a type or level, so the search box agrees with the
 *  dropdowns beside it. */
const TYPE_LABELS: Readonly<Record<EmploymentType, string>> = {
  full_time: 'Full time',
  internship: 'Internship',
  contract: 'Contract',
};

const LEVEL_LABELS: Readonly<Record<ExperienceLevel, string>> = {
  fresh_graduate: 'Fresh graduate',
  junior: 'Junior',
  mid: 'Mid level',
  senior: 'Senior',
};

export const TYPE_OPTIONS: readonly { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Any type' },
  { value: 'full_time', label: 'Full time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
];

export const LEVEL_OPTIONS: readonly { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'Any level' },
  { value: 'fresh_graduate', label: 'Fresh graduate' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
];

/**
 * Every role being recruited for at this fair (docs/11 J3).
 *
 * The default tab, because a job seeker arrives asking what work is here
 * rather than which companies are (J-D4).
 *
 * All the filtering happens here rather than being split with the server. The
 * endpoint does support `function`, `type` and `level`, and a second caller
 * should use them — but "matches my skills" cannot be a server filter on this
 * endpoint, because the server has no notion of whose skills. Filtering a
 * server-returned page again on the client would report a count for the page
 * instead of the fair, so the store loads the fair's whole list once and every
 * filter is applied to the same set.
 */
@Component({
  selector: 'app-seeker-fair-jobs-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    JobOpeningCardComponent,
  ],
  templateUrl: './seeker-fair-jobs-tab.component.html',
  styleUrl: './seeker-fair-jobs-tab.component.scss',
})
export default class SeekerFairJobsTabComponent {
  protected readonly store = inject(SeekerFairDetailStore);
  protected readonly seeker = inject(JobSeekerStore);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly levelOptions = LEVEL_OPTIONS;

  protected readonly search = signal('');
  protected readonly jobFunction = signal<string>('all');
  protected readonly type = signal<TypeFilter>('all');
  protected readonly level = signal<LevelFilter>('all');
  protected readonly matchingOnly = signal(false);

  /**
   * The viewer's own skills, lowercased for comparison.
   *
   * Openings draw from the same vocabulary a candidate's skills do, so an
   * overlap means something. Lowercasing guards the one case the vocabulary
   * does not: a profile edited by hand.
   */
  private readonly mySkills = computed(
    () => new Set((this.seeker.profile()?.skills ?? []).map((skill) => skill.toLowerCase())),
  );

  /** False when there is no profile to compare against, which hides the filter. */
  protected readonly canMatch = computed(() => this.mySkills().size > 0);

  protected readonly visible = computed<readonly FairJobOpening[]>(() => {
    const term = this.search().toLowerCase().trim();
    const jobFunction = this.jobFunction();
    const type = this.type();
    const level = this.level();
    const matchingOnly = this.matchingOnly() && this.canMatch();

    return this.store.openings().filter((opening) => {
      if (jobFunction !== 'all' && opening.jobFunction !== jobFunction) {
        return false;
      }
      if (type !== 'all' && opening.employmentType !== type) {
        return false;
      }
      if (level !== 'all' && opening.experienceLevel !== level) {
        return false;
      }
      if (matchingOnly && this.matchesFor(opening).length === 0) {
        return false;
      }
      if (term) {
        // The type and level labels are in the haystack on purpose. Someone
        // looking for an internship types "intern", and without these the
        // search returns nothing while the Type filter beside it has 19 —
        // which reads as "there are none here", not "use the other control".
        const haystack =
          `${opening.title} ${opening.employerName} ${opening.jobFunction} ` +
          `${opening.skills.join(' ')} ${TYPE_LABELS[opening.employmentType]} ` +
          `${LEVEL_LABELS[opening.experienceLevel]}`;
        if (!haystack.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly matchCount = computed(
    () => this.store.openings().filter((opening) => this.matchesFor(opening).length > 0).length,
  );

  protected readonly hasFilters = computed(
    () =>
      this.search().trim().length > 0 ||
      this.jobFunction() !== 'all' ||
      this.type() !== 'all' ||
      this.level() !== 'all' ||
      this.matchingOnly(),
  );

  /** Which of this role's skills the viewer already has. */
  protected matchesFor(opening: FairJobOpening): readonly string[] {
    const mine = this.mySkills();
    if (mine.size === 0) {
      return [];
    }
    return opening.skills.filter((skill) => mine.has(skill.toLowerCase()));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected toggleMatching(): void {
    this.matchingOnly.set(!this.matchingOnly());
  }

  protected clearFilters(): void {
    this.search.set('');
    this.jobFunction.set('all');
    this.type.set('all');
    this.level.set('all');
    this.matchingOnly.set(false);
  }
}
