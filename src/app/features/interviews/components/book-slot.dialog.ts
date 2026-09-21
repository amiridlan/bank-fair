import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { RouterLink } from '@angular/router';

import type { InterviewSlot, Shortlist } from '../../../core/models';

export interface BookSlotData {
  readonly slot: InterviewSlot;
  /** Shortlisted candidates for this fair who do not already hold a slot. */
  readonly available: readonly Shortlist[];
  /** True when nothing has been shortlisted for this fair at all. */
  readonly shortlistEmpty: boolean;
}

/**
 * Picks a shortlisted candidate for an open slot (flow F5).
 *
 * Only shortlisted candidates appear, because the API refuses anything else —
 * offering the full talent pool here would mean showing options that are
 * certain to be rejected. When the shortlist is empty the dialog says so and
 * links to the talent pool rather than presenting an empty chooser.
 */
@Component({
  selector: 'app-book-slot-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    RouterLink,
  ],
  template: `
    <h2 mat-dialog-title>
      Book {{ data.slot.startTime | date: 'h:mm a' }} – {{ data.slot.endTime | date: 'h:mm a' }}
    </h2>

    <mat-dialog-content>
      @if (data.shortlistEmpty) {
        <div class="prompt">
          <mat-icon class="prompt__icon" aria-hidden="true">bookmark_border</mat-icon>
          <h3 class="prompt__title">Shortlist candidates first</h3>
          <p class="prompt__body">
            Interviews are booked from your shortlist, so add the people you want to meet before
            filling the schedule.
          </p>
        </div>
      } @else if (data.available.length === 0) {
        <div class="prompt">
          <mat-icon class="prompt__icon" aria-hidden="true">event_available</mat-icon>
          <h3 class="prompt__title">Everyone already has a slot</h3>
          <p class="prompt__body">
            Each shortlisted candidate can hold one interview at this fair. Cancel a booking or
            shortlist someone new.
          </p>
        </div>
      } @else {
        <mat-form-field appearance="outline" class="search">
          <mat-label>Filter shortlist</mat-label>
          <input matInput type="search" cdkFocusInitial [value]="filter()" (input)="onFilter($event)" />
          <mat-icon matSuffix aria-hidden="true">search</mat-icon>
        </mat-form-field>

        @if (matches().length > 0) {
          <mat-radio-group
            class="list"
            [ngModel]="selectedId()"
            (ngModelChange)="selectedId.set($event)"
            aria-label="Shortlisted candidates"
          >
            @for (entry of matches(); track entry.id) {
              <mat-radio-button class="list__item" [value]="entry.candidateId">
                <span class="list__name">{{ entry.candidate.fullName }}</span>
                <span class="list__meta fo-caption">
                  {{ entry.candidate.fieldOfStudy }} · {{ entry.candidate.university }}
                </span>
              </mat-radio-button>
            }
          </mat-radio-group>
        } @else {
          <p class="empty fo-caption">No shortlisted candidates match “{{ filter() }}”.</p>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="dialogRef.close(null)">Cancel</button>

      @if (data.shortlistEmpty) {
        <a
          matButton="filled"
          routerLink="/hiring/talent-pool"
          (click)="dialogRef.close(null)"
        >
          Browse talent pool
        </a>
      } @else if (data.available.length > 0) {
        <button
          matButton="filled"
          type="button"
          [disabled]="!selectedId()"
          (click)="dialogRef.close(selectedId())"
        >
          Book interview
        </button>
      }
    </mat-dialog-actions>
  `,
  styleUrl: './book-slot.dialog.scss',
})
export class BookSlotDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<BookSlotDialogComponent, string | null>>(MatDialogRef);
  protected readonly data = inject<BookSlotData>(MAT_DIALOG_DATA);

  protected readonly filter = signal('');
  protected readonly selectedId = signal<string | null>(null);

  protected readonly matches = computed(() => {
    const term = this.filter().toLowerCase().trim();
    if (!term) {
      return this.data.available;
    }
    return this.data.available.filter((entry) =>
      `${entry.candidate.fullName} ${entry.candidate.fieldOfStudy} ${entry.candidate.university}`
        .toLowerCase()
        .includes(term),
    );
  });

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }
}
