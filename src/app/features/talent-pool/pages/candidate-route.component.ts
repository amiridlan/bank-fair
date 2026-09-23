import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { TalentPoolStore } from '../talent-pool.store';
import { CandidateDialogComponent } from './candidate-dialog.component';

/**
 * The child route behind the candidate profile. Renders nothing itself; it
 * opens the profile as a modal and owns the URL on its behalf.
 *
 * The profile is a route rather than a dialog opened from a table row so the
 * candidate id stays in the URL — the profile survives a refresh and the link
 * can be shared, which is what docs/02 means by deep-linkable. Opening it
 * straight from the row would have been less code and would have lost that.
 *
 * Every way of dismissing the dialog — the close button, Escape, the backdrop
 * — funnels through `afterClosed`, so the URL and the dialog cannot disagree
 * about whether a profile is open.
 */
@Component({
  selector: 'app-candidate-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export default class CandidateRouteComponent {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly store = inject(TalentPoolStore);

  private ref: MatDialogRef<CandidateDialogComponent> | null = null;

  readonly candidateId = input.required<string>();

  constructor() {
    effect(() => {
      const id = this.candidateId();

      if (this.ref) {
        // Already open and the URL changed underneath it. Push the new id in
        // rather than closing and reopening, which would flash the backdrop.
        this.ref.componentInstance.candidateId.set(id);
        return;
      }

      this.ref = this.dialog.open(CandidateDialogComponent, {
        data: { candidateId: id },
        width: '720px',
        maxWidth: '95vw',
        // Leaves room for the dialog to stay inside a short viewport; the
        // content region scrolls rather than the page.
        maxHeight: '90vh',
        autoFocus: 'first-tabbable',
      });

      this.ref.afterClosed().subscribe(() => {
        this.ref = null;
        this.store.clearSelection();
        // Back to the list, keeping the filters and page that were in the URL.
        void this.router.navigate(['/hiring/talent-pool'], {
          queryParamsHandling: 'preserve',
        });
      });
    });
  }
}
