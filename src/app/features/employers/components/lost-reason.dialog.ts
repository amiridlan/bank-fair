import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * Asks why a deal was lost (flow F2).
 *
 * The reason is required — the API rejects a `lost` move without one — so the
 * dialog cannot be confirmed empty and the move is never attempted in a state
 * the server will refuse.
 */
@Component({
  selector: 'app-lost-reason-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Mark {{ data.employerName }} as lost</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="field">
          <mat-label>Why was this lost?</mat-label>
          <textarea matInput formControlName="reason" rows="3" cdkFocusInitial></textarea>
          <mat-hint>Recorded on the employer so the team knows what happened.</mat-hint>
          @if (form.controls.reason.touched && form.controls.reason.invalid) {
            <mat-error>A reason is required.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="dialogRef.close(null)">Cancel</button>
      <button matButton="filled" type="button" (click)="confirm()">Mark as lost</button>
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
export class LostReasonDialogComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly dialogRef =
    inject<MatDialogRef<LostReasonDialogComponent, string | null>>(MatDialogRef);
  protected readonly data = inject<{ employerName: string }>(MAT_DIALOG_DATA);

  protected readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.getRawValue().reason.trim());
  }
}
