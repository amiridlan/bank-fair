import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';
import { JobSeekerStore } from '../job-seeker.store';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';

/**
 * One fair, as a job seeker sees it: the header, the tab bar, and whichever
 * tab is routed (docs/11 J2).
 *
 * A `mat-tab-nav-bar` rather than a `mat-tab-group`, for the same reason the
 * staff fair detail uses one: every tab is a URL that can be linked,
 * refreshed and shared.
 *
 * It also loads `JobSeekerStore`, which the fair list would normally have
 * loaded already — but this page is deep-linkable, so it cannot assume anyone
 * has been to the list first. Without it a direct link would render the
 * Details tab unable to say whether you are registered.
 */
@Component({
  selector: 'app-seeker-fair-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatusChipComponent,
  ],
  templateUrl: './seeker-fair-detail-page.component.html',
  styleUrl: './seeker-fair-detail-page.component.scss',
})
export default class SeekerFairDetailPageComponent {
  private readonly auth = inject(AuthStore);

  protected readonly store = inject(SeekerFairDetailStore);
  protected readonly seeker = inject(JobSeekerStore);

  readonly fairId = input.required<string>();

  /**
   * True only once the loaded fair is the one the URL asks for.
   *
   * The store is a singleton, so navigating from one fair to another leaves
   * the previous fair's contents in it for the moment before the new request
   * lands. Rendering those under the new heading would show the wrong
   * employers under the right title.
   */
  protected readonly isCurrent = computed(() => this.store.loadedId() === this.fairId());

  constructor() {
    effect(() => {
      void this.store.load(this.fairId());
    });
    effect(() => {
      void this.seeker.load(this.auth.candidateId());
    });
  }

  protected retry(): void {
    void this.store.load(this.fairId());
  }
}
