import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import {
  type ImportFailure,
  MAX_FILE_BYTES,
  ProfileImportService,
} from './profile-import.service';
import type { ImportedProfile } from './profile-parser';

type Stage = 'choose' | 'reading' | 'review' | 'failed';

interface FoundField {
  readonly label: string;
  readonly value: string;
}

const FAILURE_MESSAGE: Readonly<Record<ImportFailure['kind'], string>> = {
  'not-pdf': 'That file is not a PDF. Save your LinkedIn profile as a PDF and try again.',
  'too-large': `That file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
  encrypted: 'That PDF is password-protected, so it cannot be read. Save an unprotected copy.',
  'no-text': 'That PDF has no text in it — it looks like a scan or a photo. Fill the form in below instead.',
  unreadable: 'That PDF could not be read. Fill the form in below instead.',
};

/**
 * "Import from LinkedIn": pick the PDF LinkedIn exports, see what was found,
 * and put it into the form (docs/08 S4).
 *
 * The dialog closes with an `ImportedProfile`, never with a saved profile.
 * Parsing is heuristic and will sometimes be wrong, so what it found is shown
 * first and lands in a form the person corrects — nothing is stored until
 * they save it themselves (S-D6).
 */
@Component({
  selector: 'app-import-profile-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  templateUrl: './import-profile.dialog.html',
  styleUrl: './import-profile.dialog.scss',
})
export class ImportProfileDialogComponent {
  private readonly importer = inject(ProfileImportService);

  protected readonly dialogRef =
    inject<MatDialogRef<ImportProfileDialogComponent, ImportedProfile | null>>(MatDialogRef);

  protected readonly stage = signal<Stage>('choose');
  protected readonly fileName = signal('');
  protected readonly failure = signal<ImportFailure | null>(null);
  protected readonly profile = signal<ImportedProfile | null>(null);

  protected readonly failureMessage = computed(() => {
    const kind = this.failure()?.kind;
    return kind ? FAILURE_MESSAGE[kind] : '';
  });

  /** What was found, for the person to check before it reaches the form. */
  protected readonly found = computed<readonly FoundField[]>(() => {
    const parsed = this.profile();
    if (!parsed) {
      return [];
    }

    const fields: FoundField[] = [
      { label: 'Name', value: parsed.fullName ?? '' },
      { label: 'Headline', value: parsed.headline ?? '' },
      { label: 'University', value: parsed.university ?? '' },
      { label: 'Field of study', value: parsed.fieldOfStudy ?? '' },
      { label: 'Graduating', value: parsed.graduationYear?.toString() ?? '' },
      { label: 'Skills', value: parsed.skills.join(', ') },
    ];
    return fields.filter((field) => field.value !== '');
  });

  protected readonly missing = computed<readonly string[]>(() => {
    const parsed = this.profile();
    if (!parsed) {
      return [];
    }

    const all = ['Name', 'Headline', 'University', 'Field of study', 'Graduating', 'Skills'];
    const filled = new Set(this.found().map((field) => field.label));
    // CGPA is always here: LinkedIn has no such field and most CVs omit it.
    return [...all.filter((label) => !filled.has(label)), 'CGPA'];
  });

  protected async choose(event: Event): Promise<void> {
    const input = event.target;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) {
      return;
    }

    this.fileName.set(file.name);
    this.stage.set('reading');

    const outcome = await this.importer.import(file);

    // Clearing the input lets the same file be picked again after a failure;
    // without it, choosing it a second time fires no change event.
    if (input instanceof HTMLInputElement) {
      input.value = '';
    }

    if (!outcome.ok) {
      this.failure.set(outcome.failure);
      this.stage.set('failed');
      return;
    }

    this.profile.set(outcome.profile);
    this.stage.set('review');
  }

  protected retry(): void {
    this.failure.set(null);
    this.fileName.set('');
    this.stage.set('choose');
  }

  protected use(): void {
    this.dialogRef.close(this.profile());
  }
}
