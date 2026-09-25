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
 * **The field list must match what an employer can actually see.** It named
 * five fields while the talent pool showed eight: CGPA, qualification and the
 * profile headline were shared without being mentioned. Consent that omits a
 * field is not informed consent for that field, and CGPA is the one people are
 * least likely to assume. Checked against the talent-pool columns and the
 * candidate dialog in docs/11 V3; if either grows a field, this list grows
 * with it.
 *
 * The first sentence also states the converse — employers at other fairs
 * cannot see you — which only became true with V1. Before that the promise
 * this dialog made was not one the system kept.
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
        Registering shows your profile to the employers exhibiting at
        {{ data.fairName }} — <strong>and only to them</strong>. Employers at other fairs
        cannot see you.
      </p>

      <p class="mt-3 mb-1">They will see:</p>
      <ul class="fields">
        <li>Your name and the headline on your profile</li>
        <li>Your university, course, qualification and graduation year</li>
        <li>Your CGPA, if you have entered one</li>
        <li>Your skills</li>
      </ul>

      <p class="mt-3 mb-0">
        <strong>Your email and phone number stay hidden</strong> until an employer adds you to
        their shortlist. You can withdraw at any time, which removes your profile from this
        fair.
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
  styles: `
    /* Tailwind's preflight strips list markers, so a list styled only with
       padding renders as four orphan lines. These are a list — the reader is
       meant to see four separate things being shared, not a paragraph. */
    .fields {
      margin: 0;
      padding-inline-start: var(--fo-space-5);
      list-style: disc;
      color: var(--fo-text);
    }

    .fields li + li {
      margin-block-start: var(--fo-space-1);
    }
  `,
})
export class ConsentDialogComponent {
  protected readonly data = inject<ConsentDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<ConsentDialogComponent, boolean>>(MatDialogRef);

  /** Starts false, always. */
  protected readonly agreed = signal(false);
}
