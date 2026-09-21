import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface ConsentDialogData {
  readonly fairName: string;
}

/**
 * Asks for consent before a registration, in the words that describe what
 * actually happens.
 *
 * Not a checkbox tucked into a form. PDPA 2010 asks for consent that is
 * informed and specific, which means the person has to be told what they are
 * agreeing to, for this fair, at the moment they agree — and it must start
 * unticked, because a pre-ticked box records a decision nobody made.
 *
 * DEMO ONLY in the sense that no real personal data is involved; the shape of
 * the interaction is not a demo, and should survive into the real product.
 */
@Component({
  selector: 'app-consent-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Register for {{ data.fairName }}?</h2>

    <mat-dialog-content>
      <p class="m-0">
        Registering makes your profile visible to employers attending this fair. They will see
        your name, university, field of study, graduation year and skills.
      </p>
      <p class="mt-3 mb-0">
        <strong>Your email and phone number stay hidden</strong> until an employer adds you to
        their shortlist. You can withdraw at any time, which removes your profile from the fair.
      </p>

      <mat-checkbox class="mt-4" [checked]="agreed()" (change)="agreed.set($event.checked)">
        I agree to share my profile with employers at {{ data.fairName }}.
      </mat-checkbox>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="dialogRef.close(false)">Cancel</button>
      <button matButton="filled" type="button" [disabled]="!agreed()" (click)="dialogRef.close(true)">
        Register
      </button>
    </mat-dialog-actions>
  `,
})
export class ConsentDialogComponent {
  protected readonly data = inject<ConsentDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<ConsentDialogComponent, boolean>>(MatDialogRef);

  /** Starts false, always. */
  protected readonly agreed = signal(false);
}
