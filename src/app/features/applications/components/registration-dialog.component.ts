import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import type { ApplicationStatus } from '../../../core/models';
import { ApplicationsStore } from '../applications.store';

export interface RegistrationDialogData {
  readonly applicationId: string;
}

/** What the dialog closes with, so the route component knows what happened. */
export type RegistrationDecision =
  | { readonly kind: 'approve' }
  | { readonly kind: 'reject' }
  | null;

/**
 * An employer's fair application in full: the application itself, and the
 * employer record behind it.
 *
 * Opened by `RegistrationRouteComponent`, the child route — so the URL carries
 * the application id and one organiser can send another a link to the exact
 * one. Same arrangement as the candidate profile.
 *
 * It closes with an intent rather than deciding itself. Approving asks for
 * confirmation and turning down needs a reason, and both of those dialogs
 * belong to the page that already owns them — stacking a dialog on a dialog
 * to re-implement them here would be two copies of the same rules.
 */
@Component({
  selector: 'app-registration-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './registration-dialog.component.html',
  styleUrl: './registration-dialog.component.scss',
})
export class RegistrationDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<RegistrationDialogComponent, RegistrationDecision>>(MatDialogRef);

  protected readonly store = inject(ApplicationsStore);

  /** Writable for the same reason the candidate dialog's is: the URL can change. */
  readonly applicationId = signal(
    inject<RegistrationDialogData>(MAT_DIALOG_DATA).applicationId,
  );

  protected readonly application = computed(() =>
    this.store.applicationById(this.applicationId()),
  );

  /** The list is loaded by the page behind this; until it lands there is no row. */
  protected readonly isLoading = computed(
    () => this.store.isLoading() || (this.application() === null && !this.store.hasError()),
  );

  protected readonly isPending = computed(() => this.application()?.status === 'pending');

  constructor() {
    effect(() => {
      const employerId = this.application()?.employerId;
      if (employerId) {
        void this.store.loadEmployer(employerId);
      }
    });
  }

  protected statusLabel(status: ApplicationStatus): string {
    return status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved' : 'Turned down';
  }

  protected fairName(fairId: string): string {
    return this.store.fairName()(fairId);
  }

  /** Fairs this employer attends other than the one being applied for. */
  protected readonly otherFairs = computed<readonly string[]>(() => {
    const applyingFor = this.application()?.fairId;
    return (this.store.employer()?.fairIds ?? [])
      .filter((id) => id !== applyingFor)
      .map((id) => this.fairName(id));
  });

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected decide(kind: 'approve' | 'reject'): void {
    this.dialogRef.close({ kind });
  }
}
