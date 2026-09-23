import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import {
  RegistrationDialogComponent,
  type RegistrationDecision,
} from '../components/registration-dialog.component';
import { ApplicationsStore } from '../applications.store';
import { RegistrationDecisions } from '../registration-decisions.service';

/**
 * The child route behind an application's detail. Renders nothing; it opens
 * the detail as a modal and owns the URL on its behalf.
 *
 * Same arrangement as the candidate profile, and for the same reason: the id
 * stays in the URL, so the detail survives a refresh and one organiser can
 * send another a link to the exact application.
 *
 * The dialog closes with an intent rather than deciding itself, and this
 * hands that intent to the shared decision service — so Approve and Turn down
 * behave identically whether they were pressed on the card or in the modal.
 */
@Component({
  selector: 'app-registration-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export default class RegistrationRouteComponent {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly store = inject(ApplicationsStore);
  private readonly decisions = inject(RegistrationDecisions);

  private ref: MatDialogRef<RegistrationDialogComponent, RegistrationDecision> | null = null;

  readonly applicationId = input.required<string>();

  constructor() {
    effect(() => {
      const id = this.applicationId();

      if (this.ref) {
        this.ref.componentInstance.applicationId.set(id);
        return;
      }

      this.ref = this.dialog.open(RegistrationDialogComponent, {
        data: { applicationId: id },
        width: '760px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        autoFocus: 'first-tabbable',
      });

      this.ref.afterClosed().subscribe((decision) => {
        this.ref = null;
        this.store.clearEmployer();
        // afterClosed emits undefined when the dialog is dismissed without a
        // result — Escape, the backdrop — which means no decision.
        void this.close(id, decision ?? null);
      });
    });
  }

  /**
   * Back to the queue first, then act.
   *
   * The confirmation and the reason prompt are dialogs of their own, and
   * opening one while this route is still active would stack it on the
   * detail's backdrop.
   */
  private async close(id: string, decision: RegistrationDecision): Promise<void> {
    await this.router.navigate(['/staff/registrations'], { queryParamsHandling: 'preserve' });

    const application = this.store.applicationById(id);
    if (!application || !decision) {
      return;
    }

    if (decision.kind === 'approve') {
      await this.decisions.approve(application);
    } else {
      await this.decisions.reject(application);
    }
  }
}
