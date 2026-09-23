import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthStore } from '../../../core/auth/auth.store';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ShortlistStore } from '../../shortlist/shortlist.store';
import { TalentPoolStore } from '../talent-pool.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';

export interface CandidateDialogData {
  readonly candidateId: string;
}

/**
 * Candidate profile, shown as a modal over the talent pool.
 *
 * Opened by `CandidateRouteComponent`, which is the child route — so the URL
 * still carries the candidate id and the profile survives a refresh and can be
 * linked. A dialog opened straight from a table row would have lost that,
 * which docs/02 asks for explicitly.
 *
 * Contact details are shown only when the API says they are visible. That
 * flag comes from the server, which masks the values themselves — the UI is
 * reflecting a decision, not making one.
 */
@Component({
  selector: 'app-candidate-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    SkeletonComponent,
  
    BusyLabelComponent,
  ],
  templateUrl: './candidate-dialog.component.html',
  styleUrl: './candidate-dialog.component.scss',
})
export class CandidateDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<CandidateDialogComponent>>(MatDialogRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthStore);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(TalentPoolStore);
  protected readonly shortlist = inject(ShortlistStore);

  protected readonly note = signal('');
  protected readonly saving = signal(false);

  /**
   * Writable rather than an `input`, because a dialog is created once and the
   * route param can still change underneath it — someone editing the URL, or
   * a link followed from elsewhere. The route component pushes the new id in.
   */
  readonly candidateId = signal(inject<CandidateDialogData>(MAT_DIALOG_DATA).candidateId);

  constructor() {
    effect(() => {
      this.note.set('');
      void this.store.loadOne(this.candidateId());
    });
  }

  /** Closing is the route component's job: it owns the URL. */
  protected close(): void {
    this.dialogRef.close();
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
