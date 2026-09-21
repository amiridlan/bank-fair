import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { FairsStore } from '../fairs.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';

/**
 * One fair: the header, the tab bar, and whichever tab is routed.
 *
 * The tabs are a `mat-tab-nav-bar` rather than a `mat-tab-group`, so each one
 * is a URL that can be linked, refreshed and shared — `/staff/fairs/:id`,
 * `.../floor-plan`, `.../employers`.
 *
 * `fairId` is bound straight from the route parameter and the effect reloads
 * when it changes, so navigating between fairs needs no `ActivatedRoute`
 * subscription. The children receive the same parameter, which requires
 * `paramsInheritanceStrategy: 'always'` — see `app.config.ts`.
 */
@Component({
  selector: 'app-fair-detail-page',
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
  templateUrl: './fair-detail-page.component.html',
  styleUrl: './fair-detail-page.component.scss',
})
export default class FairDetailPageComponent {
  protected readonly store = inject(FairsStore);

  readonly fairId = input.required<string>();

  constructor() {
    effect(() => {
      void this.store.loadOne(this.fairId());
    });
  }

  protected retry(): void {
    void this.store.loadOne(this.fairId());
  }
}
