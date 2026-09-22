import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ShortlistStore } from '../../shortlist/shortlist.store';
import { TalentPoolStore } from '../talent-pool.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';

/**
 * Candidate profile, shown as a right-hand drawer over the talent pool.
 *
 * A child route rather than a dialog, so the URL carries the candidate id:
 * the drawer survives a refresh and the link can be shared, which is what
 * "deep-linkable" in docs/02 asks for.
 *
 * Contact details are shown only when the API says they are visible. That
 * flag comes from the server, which masks the values themselves — the UI is
 * reflecting a decision, not making one.
 */
@Component({
  selector: 'app-candidate-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    SkeletonComponent,
  
    BusyLabelComponent,
  ],
  templateUrl: './candidate-drawer.component.html',
  styleUrl: './candidate-drawer.component.scss',
})
export default class CandidateDrawerComponent {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthStore);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(TalentPoolStore);
  protected readonly shortlist = inject(ShortlistStore);

  protected readonly note = signal('');
  protected readonly saving = signal(false);

  readonly candidateId = input.required<string>();

  constructor() {
    effect(() => {
      this.note.set('');
      void this.store.loadOne(this.candidateId());
    });
  }

  protected close(): void {
    this.store.clearSelection();
    void this.router.navigate(['/hiring/talent-pool'], { queryParamsHandling: 'preserve' });
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected isShortlisted(candidateId: string): boolean {
    return this.shortlist.isShortlisted(candidateId);
  }

  protected async addToShortlist(): Promise<void> {
    const candidate = this.store.selected();
    const fairId = this.auth.activeFairId();

    if (!candidate || !fairId || this.saving()) {
      return;
    }

    this.saving.set(true);
    const result = await this.shortlist.add(candidate.id, fairId, this.note().trim() || null);
    this.saving.set(false);

    if (result.duplicate) {
      this.snackBar.open(`${candidate.fullName} is already on your shortlist.`, 'Dismiss', {
        duration: 5000,
      });
      return;
    }

    if (result.error) {
      const snack = this.snackBar.open(
        `Couldn't shortlist ${candidate.fullName}.`,
        'Retry',
        { duration: 8000 },
      );
      snack.onAction().subscribe(() => void this.addToShortlist());
      return;
    }

    // The response carries the candidate unmasked; patch rather than refetch.
    if (result.candidate) {
      this.store.patchCandidate(result.candidate);
    }
    // Unmasking contact details is a state change with no visual cue of its
    // own for a screen-reader user, so say it.
    this.announcer.announce(
      `${candidate.fullName} added to your shortlist. Contact details are now visible.`,
      'polite',
    );
    this.snackBar.open(`${candidate.fullName} added to your shortlist.`, 'Dismiss', {
      duration: 5000,
    });
  }

  protected async removeFromShortlist(): Promise<void> {
    const candidate = this.store.selected();
    if (!candidate) {
      return;
    }
    const entry = this.shortlist.entryForCandidate(candidate.id);
    if (!entry) {
      return;
    }

    const error = await this.shortlist.remove(entry.id);
    if (error) {
      this.snackBar.open("Couldn't remove from the shortlist.", 'Dismiss', { duration: 6000 });
      return;
    }

    this.announcer.announce(
      `${candidate.fullName} removed from your shortlist. Contact details are hidden again.`,
      'polite',
    );
    // Contact details are masked again, so reload rather than guess.
    void this.store.loadOne(candidate.id);
  }

  /** False when no fair is active, which is what the Add button waits on. */
  protected hasActiveFair(): boolean {
    return this.auth.activeFairId() !== null;
  }
}
