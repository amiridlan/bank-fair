import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { Booth, Employer } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import {
  AssignBoothDialogComponent,
  type AssignBoothResult,
} from '../components/assign-booth.dialog';
import { BoothTileComponent } from '../components/booth-tile.component';
import { FloorPlanStore } from '../floor-plan.store';

/**
 * Floor plan (flow F1).
 *
 * Two ways to assign a booth, both ending in `assign()`: drag an employer
 * from the side list onto a tile, or select a tile and use "Assign employer",
 * which opens a filterable list. The keyboard path is not a fallback — it is
 * required, and it is the only path that works for anyone who cannot drag.
 */
@Component({
  selector: 'app-floor-plan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    BoothTileComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './floor-plan-page.component.html',
  styleUrl: './floor-plan-page.component.scss',
})
export default class FloorPlanPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly store = inject(FloorPlanStore);
  protected readonly selectedBoothId = signal<string | null>(null);

  readonly fairId = input.required<string>();

  constructor() {
    effect(() => {
      this.selectedBoothId.set(null);
      void this.store.load(this.fairId());
    });
  }

  protected selectBooth(booth: Booth): void {
    this.selectedBoothId.update((current) => (current === booth.id ? null : booth.id));
  }

  protected async onDrop(event: CdkDragDrop<Booth>, booth: Booth): Promise<void> {
    const employer = event.item.data as Employer;
    await this.assign(booth, employer.id);
  }

  /** Opens the keyboard path for the selected booth. */
  protected async openAssignDialog(): Promise<void> {
    const boothId = this.selectedBoothId();
    const booth = boothId ? this.store.boothById(boothId) : null;
    if (!booth) {
      return;
    }

    const result: AssignBoothResult | undefined = await firstValueFrom(
      this.dialog
        .open(AssignBoothDialogComponent, {
          data: { booth, employers: this.store.unassignedEmployers() },
        })
        .afterClosed(),
    );

    if (result) {
      await this.assign(booth, result.employerId);
    }
  }

  /**
   * The one path both drag and keyboard take.
   *
   * A 409 is a branch rather than a failure: the booth is already taken, so
   * ask before replacing rather than overwriting someone's booking.
   */
  protected async assign(booth: Booth, employerId: string | null): Promise<void> {
    const employer = employerId ? this.store.employerById(employerId) : null;
    const result = await this.store.assign(booth.id, employerId);

    if (result.conflict && employer) {
      const confirmed = await firstValueFrom(
        this.dialog
          .open(ConfirmDialogComponent, {
            data: {
              title: 'Replace this booth’s employer?',
              message: `${booth.employerName} currently holds ${booth.code}. Assign it to ${employer.name} instead?`,
              confirmLabel: `Assign to ${employer.name}`,
              cancelLabel: 'Keep as is',
            },
          })
          .afterClosed(),
      );

      if (!confirmed) {
        return;
      }

      const forced = await this.store.assign(booth.id, employerId, true);
      this.reportAssign(booth, employer, forced.error, forced.previousEmployerId);
      return;
    }

    this.reportAssign(booth, employer, result.error, result.previousEmployerId);
  }

  private reportAssign(
    booth: Booth,
    employer: Employer | null,
    error: { message: string } | null,
    previousEmployerId: string | null,
  ): void {
    if (error) {
      // The store already restored the grid.
      this.announcer.announce(`Could not assign booth ${booth.code}.`, 'assertive');
      const snack = this.snackBar.open("Couldn't assign booth. Try again.", 'Retry', {
        duration: 8000,
      });
      snack.onAction().subscribe(() => void this.assign(booth, employer?.id ?? null));
      return;
    }

    if (!employer) {
      this.announcer.announce(`Booth ${booth.code} cleared.`, 'polite');
      this.snackBar.open(`Booth ${booth.code} cleared.`, 'Dismiss', { duration: 5000 });
      return;
    }

    this.announcer.announce(`${employer.name} assigned to booth ${booth.code}.`, 'polite');

    const snack = this.snackBar.open(`${employer.name} assigned to ${booth.code}.`, 'Undo', {
      duration: 8000,
    });
    // Undo restores whoever held the booth before, which for an empty booth
    // means clearing it again.
    snack.onAction().subscribe(() => void this.store.assign(booth.id, previousEmployerId, true));
  }

  protected retry(): void {
    void this.store.load(this.fairId());
  }
}
