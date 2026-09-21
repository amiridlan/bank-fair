import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

import type { Booth, Employer } from '../../../core/models';

export interface AssignBoothData {
  readonly booth: Booth;
  readonly employers: readonly Employer[];
}

/** `null` clears the booth; a string assigns that employer. */
export type AssignBoothResult = { readonly employerId: string | null } | null;

/**
 * The keyboard path for flow F1: pick an employer for a booth without
 * dragging anything.
 *
 * A filterable radio list rather than a `mat-select`, because the list can run
 * to dozens of employers and typing to narrow it is faster than scrolling a
 * dropdown with arrow keys.
 */
@Component({
  selector: 'app-assign-booth-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
  ],
  template: `
    <h2 mat-dialog-title>Assign booth {{ data.booth.code }}</h2>

    <mat-dialog-content>
      @if (data.booth.employerName; as current) {
        <p class="current fo-caption">
          Currently assigned to <strong>{{ current }}</strong
          >.
        </p>
      }

      <mat-form-field appearance="outline" class="search">
        <mat-label>Filter employers</mat-label>
        <input
          matInput
          type="search"
          cdkFocusInitial
          [value]="filter()"
          (input)="onFilter($event)"
        />
        <mat-icon matSuffix aria-hidden="true">search</mat-icon>
      </mat-form-field>

      @if (matches().length > 0) {
        <mat-radio-group
          class="list"
          [ngModel]="selectedId()"
          (ngModelChange)="selectedId.set($event)"
          [attr.aria-label]="'Employers available for booth ' + data.booth.code"
        >
          @for (employer of matches(); track employer.id) {
            <mat-radio-button class="list__item" [value]="employer.id">
              <span class="list__name">{{ employer.name }}</span>
              <span class="list__meta fo-caption">{{ employer.industry }}</span>
            </mat-radio-button>
          }
        </mat-radio-group>
      } @else {
        <p class="empty fo-caption">
          @if (data.employers.length === 0) {
            All confirmed employers have booths.
          } @else {
            No employers match “{{ filter() }}”.
          }
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (data.booth.employerId) {
        <button matButton type="button" (click)="dialogRef.close({ employerId: null })">
          Clear booth
        </button>
      }
      <button matButton type="button" (click)="dialogRef.close(null)">Cancel</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="!selectedId()"
        (click)="dialogRef.close({ employerId: selectedId() })"
      >
        Assign booth
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './assign-booth.dialog.scss',
})
export class AssignBoothDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<AssignBoothDialogComponent, AssignBoothResult>>(MatDialogRef);
  protected readonly data = inject<AssignBoothData>(MAT_DIALOG_DATA);

  protected readonly filter = signal('');
  protected readonly selectedId = signal<string | null>(null);

  protected readonly matches = computed(() => {
    const term = this.filter().toLowerCase().trim();
    if (!term) {
      return this.data.employers;
    }
    return this.data.employers.filter((employer) =>
      `${employer.name} ${employer.industry}`.toLowerCase().includes(term),
    );
  });

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }
}
