import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { FairContextStore } from '../../../core/fairs/fair-context.store';
import type { Shortlist } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ShortlistStore } from '../shortlist.store';

/**
 * The candidates this employer has shortlisted for the active fair.
 *
 * Contact details are shown in full here: shortlisting is what unlocks them,
 * and the API returns them unmasked for exactly these candidates.
 */
@Component({
  selector: 'app-shortlist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './shortlist-page.component.html',
  styleUrl: './shortlist-page.component.scss',
})
export default class ShortlistPageComponent {
  private readonly auth = inject(AuthStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(ShortlistStore);
  protected readonly fairContext = inject(FairContextStore);

  constructor() {
    effect(() => void this.store.load(this.auth.activeFairId()));
  }

  protected hasActiveFair(): boolean {
    return this.auth.activeFairId() !== null;
  }

  protected async remove(entry: Shortlist): Promise<void> {
    const error = await this.store.remove(entry.id);
    if (error) {
      // The store has already put the entry back.
      this.announcer.announce(`Could not remove ${entry.candidate.fullName}.`, 'assertive');
      const snack = this.snackBar.open(
        `Couldn't remove ${entry.candidate.fullName}.`,
        'Retry',
        { duration: 8000 },
      );
      snack.onAction().subscribe(() => void this.remove(entry));
      return;
    }
    this.announcer.announce(`${entry.candidate.fullName} removed from your shortlist.`, 'polite');
    this.snackBar.open(`${entry.candidate.fullName} removed.`, 'Dismiss', { duration: 5000 });
  }

  protected retry(): void {
    void this.store.load(this.auth.activeFairId());
  }
}
