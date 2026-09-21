import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { JobSeekerStore } from '../job-seeker.store';

/**
 * The job seeker's own record — the same one employers browse in the talent
 * pool, not a second copy of it.
 *
 * Read-only for now. Editing arrives with S4, where the import fills the form
 * and the person corrects it; building an edit form here and replacing it
 * there would be work done twice.
 */
@Component({
  selector: 'app-seeker-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './seeker-profile-page.component.html',
  styleUrl: './seeker-profile-page.component.scss',
})
export default class SeekerProfilePageComponent {
  private readonly auth = inject(AuthStore);

  protected readonly store = inject(JobSeekerStore);

  /** Fairs this profile is currently visible at, newest registration first. */
  protected readonly visibleAt = computed(() => {
    const byId = new Map(this.store.fairs().map((fair) => [fair.id, fair]));
    return this.store
      .registrations()
      .map((entry) => byId.get(entry.fairId))
      .filter((fair) => fair !== undefined);
  });

  constructor() {
    effect(() => void this.store.load(this.auth.candidateId()));
  }

  protected retry(): void {
    void this.store.load(this.auth.candidateId());
  }
}
