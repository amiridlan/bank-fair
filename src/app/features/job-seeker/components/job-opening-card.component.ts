import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type {
  EmploymentType,
  ExperienceLevel,
  FairJobOpening,
} from '../../../core/models';

/** Exhaustive, so a new member cannot render as a raw slug. */
const TYPE_LABEL: Readonly<Record<EmploymentType, string>> = {
  full_time: 'Full time',
  internship: 'Internship',
  contract: 'Contract',
};

const LEVEL_LABEL: Readonly<Record<ExperienceLevel, string>> = {
  fresh_graduate: 'Fresh graduate',
  junior: 'Junior',
  mid: 'Mid level',
  senior: 'Senior',
};

/**
 * One advertised role.
 *
 * `matchedSkills` is passed in rather than worked out here: the comparison
 * needs the viewer's profile, and a presentational card should not be reaching
 * for a store to find out who is looking at it.
 */
@Component({
  selector: 'app-job-opening-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './job-opening-card.component.html',
  styleUrl: './job-opening-card.component.scss',
})
export class JobOpeningCardComponent {
  readonly opening = input.required<FairJobOpening>();
  /** Skills this role wants that the viewer already has. Empty when none. */
  readonly matchedSkills = input<readonly string[]>([]);

  protected readonly typeLabel = computed(() => TYPE_LABEL[this.opening().employmentType]);
  protected readonly levelLabel = computed(() => LEVEL_LABEL[this.opening().experienceLevel]);

  protected readonly hasSalary = computed(() => this.opening().salaryMinMyr !== null);

  protected readonly matched = computed(() => new Set(this.matchedSkills()));

  protected isMatched(skill: string): boolean {
    return this.matched().has(skill);
  }
}
