import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import type { ApiError } from '../../../core/http/api-error';
import type { Candidate, Qualification } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ImportProfileDialogComponent } from '../import/import-profile.dialog';
import type { ImportedProfile } from '../import/profile-parser';
import { JobSeekerStore } from '../job-seeker.store';

const QUALIFICATIONS: readonly { value: Qualification; label: string }[] = [
  { value: 'diploma', label: 'Diploma' },
  { value: 'degree', label: 'Bachelor’s degree' },
  { value: 'masters', label: 'Master’s degree' },
  { value: 'phd', label: 'PhD' },
];

/**
 * The job seeker's own record — the same one employers browse in the talent
 * pool, not a second copy of it — and the form that edits it (docs/08 S4).
 *
 * The import fills this form; it never saves. Everything a parse found lands
 * in a control the person can correct, and the record changes only when they
 * press Save.
 */
@Component({
  selector: 'app-seeker-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './seeker-profile-page.component.html',
  styleUrl: './seeker-profile-page.component.scss',
})
export default class SeekerProfilePageComponent {
  private readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(JobSeekerStore);
  protected readonly qualifications = QUALIFICATIONS;

  /** Fields the last import could not fill, named on the form rather than left blank. */
  protected readonly importedGaps = signal<readonly string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(80)]],
    headline: ['', [Validators.required, Validators.maxLength(120)]],
    university: ['', [Validators.required, Validators.maxLength(120)]],
    fieldOfStudy: ['', [Validators.required, Validators.maxLength(80)]],
    qualification: ['degree' as Qualification, Validators.required],
    graduationYear: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(new Date().getFullYear() - 60), Validators.max(new Date().getFullYear() + 10)],
    ],
    // Optional: LinkedIn has no CGPA field and most CVs carry none.
    cgpa: ['', [Validators.pattern(/^([0-3](\.\d{1,2})?|4(\.0{1,2})?)$/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    skills: ['', Validators.maxLength(400)],
  });

  /** Fairs this profile is currently visible at. */
  protected readonly visibleAt = computed(() => {
    const byId = new Map(this.store.fairs().map((fair) => [fair.id, fair]));
    return this.store
      .registrations()
      .map((entry) => byId.get(entry.fairId))
      .filter((fair) => fair !== undefined);
  });

  constructor() {
    effect(() => void this.store.load(this.auth.candidateId()));

    // Fills the form once the record arrives, and again after a save, so the
    // form always shows what the API actually stored rather than what was typed.
    effect(() => {
      const profile = this.store.profile();
      if (profile) {
        this.form.reset(toFormValue(profile));
      }
    });
  }

  protected async importFromPdf(): Promise<void> {
    const imported = await firstValueFrom(
      this.dialog
        .open(ImportProfileDialogComponent, { width: '560px', maxWidth: '95vw' })
        .afterClosed(),
    );

    if (!imported) {
      return;
    }

    this.applyImport(imported);
  }

  /**
   * Puts what was found into the form, and leaves the rest alone.
   *
   * A field the parser was unsure about is null, and null must not wipe what
   * the person already has: an import that blanked a correct university
   * because the PDF was unclear would be worse than no import.
   */
  private applyImport(imported: ImportedProfile): void {
    const patch: Record<string, string | number> = {};
    const gaps: string[] = [];

    const assign = (
      control: keyof typeof this.form.controls,
      label: string,
      value: string | number | null,
    ): void => {
      if (value === null || value === '') {
        gaps.push(label);
        return;
      }
      patch[control] = value;
    };

    assign('fullName', 'Name', imported.fullName);
    assign('headline', 'Headline', imported.headline);
    assign('university', 'University', imported.university);
    assign('fieldOfStudy', 'Field of study', imported.fieldOfStudy);
    assign('qualification', 'Qualification', imported.qualification);
    assign('graduationYear', 'Graduating', imported.graduationYear);
    assign('skills', 'Skills', imported.skills.join(', '));
    // The parser never supplies this one: LinkedIn has no CGPA field.
    gaps.push('CGPA');

    this.form.patchValue(patch);
    this.form.markAsDirty();
    this.importedGaps.set(gaps);

    const filled = Object.keys(patch).length;
    this.announcer.announce(
      `Imported ${filled} field${filled === 1 ? '' : 's'}. Check them, then save.`,
      'polite',
    );
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.announcer.announce('Some fields need fixing before this can be saved.', 'assertive');
      return;
    }

    const value = this.form.getRawValue();
    const error = await this.store.saveProfile({
      fullName: value.fullName,
      headline: value.headline,
      university: value.university,
      fieldOfStudy: value.fieldOfStudy,
      qualification: value.qualification,
      graduationYear: Number(value.graduationYear),
      cgpa: value.cgpa.trim() === '' ? null : Number(value.cgpa),
      email: value.email,
      phone: value.phone.trim() === '' ? null : value.phone.trim(),
      skills: splitSkills(value.skills),
    });

    if (error) {
      this.applyServerErrors(error);
      return;
    }

    this.importedGaps.set([]);
    this.announcer.announce('Profile saved.', 'polite');
    this.snackBar.open('Profile saved.', 'Dismiss', { duration: 4000 });
  }

  /**
   * Attaches a 422 to the controls it names (Laravel's shape), so the message
   * appears at the field rather than in a snackbar the person has to map back
   * to a form.
   */
  private applyServerErrors(error: ApiError): void {
    const entries = Object.entries(error.fieldErrors);

    for (const [field, messages] of entries) {
      const control = this.form.get(field);
      if (control) {
        control.setErrors({ server: messages[0] });
        control.markAsTouched();
      }
    }

    if (entries.length === 0) {
      this.snackBar.open("Couldn't save your profile.", 'Dismiss', { duration: 6000 });
    }
    this.announcer.announce('Your profile could not be saved.', 'assertive');
  }

  /** The message for a control, server-supplied or local. */
  protected errorFor(field: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) {
      return null;
    }
    const errors = control.errors ?? {};
    if (typeof errors['server'] === 'string') {
      return errors['server'];
    }
    if (errors['required']) {
      return 'This is required.';
    }
    if (errors['email']) {
      return 'That does not look like an email address.';
    }
    if (errors['pattern']) {
      return 'Enter a CGPA between 0.00 and 4.00.';
    }
    if (errors['min'] || errors['max']) {
      return 'That is not a plausible year.';
    }
    if (errors['maxlength']) {
      return 'That is too long.';
    }
    return 'Please check this.';
  }

  protected resetForm(): void {
    const profile = this.store.profile();
    if (profile) {
      this.form.reset(toFormValue(profile));
      this.importedGaps.set([]);
    }
  }

  protected retry(): void {
    void this.store.load(this.auth.candidateId());
  }
}

function toFormValue(profile: Candidate) {
  return {
    fullName: profile.fullName,
    headline: profile.headline,
    university: profile.university,
    fieldOfStudy: profile.fieldOfStudy,
    qualification: profile.qualification,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa === null ? '' : profile.cgpa.toFixed(2),
    email: profile.email,
    phone: profile.phone ?? '',
    skills: profile.skills.join(', '),
  };
}

/** Comma-separated in, list out, with the blanks and duplicates removed. */
function splitSkills(value: string): readonly string[] {
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const raw of value.split(',')) {
    const skill = raw.trim();
    const key = skill.toLowerCase();
    if (skill !== '' && !seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }
  return skills;
}
