import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  FormBuilder,
  type FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import type { ApiError } from '../../../core/http/api-error';
import { isValidationError } from '../../../core/http/api-error';
import type { BoothPackage, CompanySize, Employer, EmployerInput } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmployersStore } from '../employers.store';
import { BusyLabelComponent } from '../../../shared/ui/busy-label.component';

export interface EmployerFormData {
  /** Null when adding; the employer to edit otherwise. */
  readonly employer: Employer | null;
  /** Shown as a banner, e.g. when a Paid move was blocked by a missing package. */
  readonly reason?: string;
}

const COMPANY_SIZES: readonly CompanySize[] = ['1-50', '51-200', '201-1000', '1000+'];
const BOOTH_PACKAGES: readonly BoothPackage[] = ['standard', 'premium', 'platinum'];
const INDUSTRIES: readonly string[] = [
  'Banking & Finance',
  'Semiconductor',
  'Oil & Gas',
  'FMCG',
  'Telco',
  'Consulting',
  'Technology',
  'Logistics',
  'Healthcare',
  'Property',
];

/** Malaysian mobile format, e.g. `+60 12-345 6789`. Optional field. */
const MY_PHONE = /^\+60\s?1\d[-\s]?\d{3,4}\s?\d{4}$/;

/**
 * Add or edit an employer (flow F3).
 *
 * Typed reactive form built with `nonNullable`, so every control's value is
 * the declared type rather than `T | null` and the template needs no
 * null-guards.
 *
 * Server validation is mapped back onto the controls: a 422 sets
 * `serverError` on the matching field, and the error clears as soon as the
 * user edits that field, so a stale message never blocks resubmission.
 */
@Component({
  selector: 'app-employer-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  
    BusyLabelComponent,
  ],
  templateUrl: './employer-form.dialog.html',
  styleUrl: './employer-form.dialog.scss',
})
export class EmployerFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(EmployersStore);
  private readonly dialog = inject(MatDialog);

  protected readonly dialogRef =
    inject<MatDialogRef<EmployerFormDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<EmployerFormData>(MAT_DIALOG_DATA);

  protected readonly companySizes = COMPANY_SIZES;
  protected readonly boothPackages = BOOTH_PACKAGES;
  protected readonly industries = INDUSTRIES;

  protected readonly saving = signal(false);
  /** Non-field error shown as a banner; the form stays open and Save re-enables. */
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = this.data.employer !== null;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    industry: ['', Validators.required],
    companySize: this.fb.nonNullable.control<CompanySize>('51-200', Validators.required),
    contactName: ['', Validators.required],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', Validators.pattern(MY_PHONE)],
    boothPackage: this.fb.nonNullable.control<BoothPackage | ''>(''),
    notes: [''],
  });

  constructor() {
    const employer = this.data.employer;
    if (employer) {
      this.form.setValue({
        name: employer.name,
        industry: employer.industry,
        companySize: employer.companySize,
        contactName: employer.contactName,
        contactEmail: employer.contactEmail,
        contactPhone: employer.contactPhone ?? '',
        boothPackage: employer.boothPackage ?? '',
        notes: employer.notes ?? '',
      });
    }

    // Route Escape and backdrop clicks through the dirty check instead of
    // letting them discard silently. disableClose alone would have broken
    // Escape entirely, which dialogs are expected to honour.
    this.dialogRef.disableClose = true;
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        void this.requestClose();
      }
    });
    this.dialogRef.backdropClick().subscribe(() => void this.requestClose());

    // Editing a field clears the server error it carried, so a message from a
    // previous submission cannot keep the form invalid.
    for (const control of Object.values(this.form.controls)) {
      control.valueChanges.subscribe(() => {
        if (control.hasError('serverError')) {
          const rest = { ...(control.errors ?? {}) };
          delete rest['serverError'];
          control.setErrors(Object.keys(rest).length > 0 ? rest : null);
        }
      });
    }
  }

  /** First error message for a control, in priority order. */
  protected errorFor(name: keyof typeof this.form.controls): string | null {
    const control: FormControl = this.form.controls[name];
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('serverError')) {
      return String(control.getError('serverError'));
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('pattern')) {
      return 'Use a Malaysian mobile number, for example +60 12-345 6789.';
    }
    if (control.hasError('maxlength')) {
      return 'That name is too long.';
    }
    return null;
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);

    if (this.form.invalid || this.saving()) {
      return;
    }

    const raw = this.form.getRawValue();
    const input: EmployerInput = {
      name: raw.name.trim(),
      industry: raw.industry,
      companySize: raw.companySize,
      contactName: raw.contactName.trim(),
      contactEmail: raw.contactEmail.trim(),
      contactPhone: raw.contactPhone.trim() || null,
      boothPackage: raw.boothPackage === '' ? null : raw.boothPackage,
      notes: raw.notes.trim() || null,
    };

    this.saving.set(true);
    const employer = this.data.employer;
    const error = employer
      ? await this.store.update(employer.id, input)
      : await this.store.create(input);
    this.saving.set(false);

    if (!error) {
      this.form.markAsPristine();
      this.dialogRef.close(true);
      return;
    }

    this.applyServerError(error);
  }

  /** Maps a 422 onto the form's controls; anything else becomes a banner. */
  private applyServerError(error: ApiError): void {
    if (!isValidationError(error)) {
      this.formError.set(error.message);
      return;
    }

    let matched = false;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      const control = this.form.get(field);
      if (control && messages.length > 0) {
        control.setErrors({ ...(control.errors ?? {}), serverError: messages[0] });
        control.markAsTouched();
        matched = true;
      }
    }

    // A field error for something this form does not show would otherwise be
    // invisible, leaving the user stuck with no explanation.
    if (!matched) {
      this.formError.set(error.message);
    }
  }

  /** Closing a dirty form asks first (flow F3). */
  protected async requestClose(): Promise<void> {
    if (!this.form.dirty || this.saving()) {
      this.dialogRef.close(false);
      return;
    }

    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Discard changes?',
            message: 'Your edits to this employer will not be saved.',
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing',
            destructive: true,
          },
        })
        .afterClosed(),
    );

    if (confirmed) {
      this.dialogRef.close(false);
    }
  }
}
