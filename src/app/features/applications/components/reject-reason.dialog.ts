import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface RejectReasonData {
  readonly employerName: string;
  readonly fairName: string;
}

/**
 * Asks why an application was turned down.
 *
 * The reason is required, and the API refuses a rejection without one, so the
 * dialog cannot be confirmed empty and the request is never attempted in a
 * state the server will refuse. The employer sees this text, which is the
 * whole reason it exists: being told no without being told why leaves nothing
 * to act on.
 */
@Component({
  selector: 'app-reject-reason-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Turn down {{ data.employerName }}?</h2>
    <mat-dialog-content>
      <p class="mt-0">
        They applied to attend {{ data.fairName }}. The reason below is shown to them.
      </p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="field">
          <mat-label>Why are they not accepted?</mat-label>
          <textarea matInput formControlName="reason" rows="3" cdkFocusInitial></textarea>
          <mat-hint>Written to the employer, so keep it useful.</mat-hint>
          @if (form.controls.reason.touched && form.controls.reason.invalid) {
            <mat-error>A reason is required.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="dialogRef.close(null)">Cancel</button>
      <button matButton="filled" type="button" (click)="confirm()">Turn down</button>
    </mat-dialog-actions>
  `,
  styles: `
    .field {
      width: 100%;
      min-width: 360px;
    }

    @media (max-width: 599px) {
      .field {
        min-width: 0;
      }
    }
  `,
})
export class RejectReasonDialogComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly data = inject<RejectReasonData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<RejectReasonDialogComponent, string | null>>(MatDialogRef);

  protected readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(300)]],
  });

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue().reason.trim());
  }
}
