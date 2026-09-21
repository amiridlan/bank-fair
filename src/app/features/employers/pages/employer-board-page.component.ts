import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ViewportRuler } from '@angular/cdk/scrolling';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DecimalPipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import type { Employer, EmployerStage } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { EmployerCardComponent } from '../components/employer-card.component';
import {
  EmployerFormDialogComponent,
  type EmployerFormData,
} from '../components/employer-form.dialog';
import { LostReasonDialogComponent } from '../components/lost-reason.dialog';
import { EmployersStore, PIPELINE_STAGES, STAGE_LABEL } from '../employers.store';

/**
 * Employer pipeline board (flows F2 and F3).
 *
 * Drag moves a card between columns; the card's overflow menu does the same
 * thing from the keyboard. Both paths go through `move()`, so the branch
 * rules — a reason for Lost, a booth package for Paid — hold however the move
 * was started, and neither path can bypass the other's guardrails.
 */
@Component({
  selector: 'app-employer-board-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    EmployerCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './employer-board-page.component.html',
  styleUrl: './employer-board-page.component.scss',
})
export default class EmployerBoardPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);

  private readonly viewportRuler = inject(ViewportRuler);

  protected readonly store = inject(EmployersStore);
  protected readonly stages = PIPELINE_STAGES;

  private readonly board = viewChild<ElementRef<HTMLElement>>('board');

  /**
   * True while the board has content scrolled off to the right.
   *
   * The fade it drives is the only thing telling a user there is more board
   * than they can see, so it has to track the real state rather than being
   * painted on — hence measuring on scroll and on resize rather than assuming.
   */
  protected readonly overflowsRight = signal(false);

  constructor() {
    void this.store.load();

    // ViewportRuler rather than a ResizeObserver: the board only changes width
    // when the viewport does, the CDK is already a dependency, and unlike
    // ResizeObserver it exists under jsdom — so this cannot take the whole
    // board down in an environment that lacks it.
    this.viewportRuler
      .change(100)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.measure());

    // The board element does not exist until the employers land, so a one-shot
    // render hook measures nothing. This re-runs when the element appears and
    // again whenever the columns change, since a search can remove enough
    // cards to change whether the board overflows at all.
    afterRenderEffect(() => {
      this.board();
      this.store.byStage();
      this.measure();
    });
  }

  /** Called on scroll, on resize, and whenever the board re-renders. */
  protected measure(): void {
    const el = this.board()?.nativeElement;
    if (!el) {
      this.overflowsRight.set(false);
      return;
    }
    // 1px of slack: fractional layout widths otherwise leave the fade on
    // permanently at some zoom levels.
    this.overflowsRight.set(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }

  protected label(stage: EmployerStage): string {
    return STAGE_LABEL[stage];
  }

  /** Narrows the DOM event rather than reaching for `$any` in the template. */
  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  /** Column ids for `cdkDropListConnectedTo`, so every column accepts drops. */
  protected readonly columnIds = PIPELINE_STAGES.map((stage) => `column-${stage}`);

  protected async onDrop(event: CdkDragDrop<EmployerStage>, target: EmployerStage): Promise<void> {
    // Reordering inside a column carries no meaning on this board.
    if (event.previousContainer === event.container) {
      return;
    }
    const employer = event.item.data as Employer;
    await this.move(employer, target);
  }

  /**
   * The single path every move takes, from a drag or from the menu.
   *
   * Lost needs a reason and Paid needs a booth package; both are collected
   * before the optimistic update, so the board never shows a move the server
   * is certain to reject.
   */
  protected async move(employer: Employer, stage: EmployerStage): Promise<void> {
    if (employer.stage === stage) {
      return;
    }

    let lostReason: string | null = null;

    if (stage === 'lost') {
      const reason = await firstValueFrom(
        this.dialog
          .open(LostReasonDialogComponent, { data: { employerName: employer.name } })
          .afterClosed(),
      );
      if (!reason) {
        return;
      }
      lostReason = reason;
    }

    if (stage === 'paid' && employer.boothPackage === null) {
      const saved = await this.openForm({
        employer,
        reason: `${employer.name} needs a booth package before it can be marked Paid.`,
      });
      if (!saved) {
        return;
      }
      // Re-read: the form may have set the package, which unblocks the move.
      const refreshed = this.store.employers().find((entry) => entry.id === employer.id);
      if (!refreshed || refreshed.boothPackage === null) {
        return;
      }
      employer = refreshed;
    }

    const error = await this.store.moveStage({ employerId: employer.id, stage, lostReason });

    if (error) {
      // The store has already rolled the card back to where it was.
      this.announcer.announce(`Could not move ${employer.name}. ${error.message}`, 'assertive');
      const snack = this.snackBar.open(`Couldn't move ${employer.name}.`, 'Retry', {
        duration: 8000,
      });
      snack.onAction().subscribe(() => void this.move(employer, stage));
      return;
    }

    this.announcer.announce(`${employer.name} moved to ${STAGE_LABEL[stage]}.`, 'polite');
  }

  protected async addEmployer(): Promise<void> {
    await this.openForm({ employer: null });
  }

  protected async editEmployer(employer: Employer): Promise<void> {
    await this.openForm({ employer });
  }

  /** Resolves true when the dialog saved. */
  private async openForm(data: EmployerFormData): Promise<boolean> {
    // The dialog sets disableClose itself and routes Escape and backdrop
    // clicks through its own dirty check.
    const saved = await firstValueFrom(
      this.dialog
        .open(EmployerFormDialogComponent, { data, width: '720px', maxWidth: '95vw' })
        .afterClosed(),
    );
    return saved === true;
  }

  protected retry(): void {
    void this.store.load();
  }
}
