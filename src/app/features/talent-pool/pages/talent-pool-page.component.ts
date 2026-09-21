import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterOutlet } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import type { Candidate } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { ShortlistStore } from '../../shortlist/shortlist.store';
import { DEFAULT_FILTERS, type SortField, TalentPoolStore } from '../talent-pool.store';

/** Kept in step with the seed data in docs/05. */
const UNIVERSITIES: readonly string[] = [
  'Universiti Malaya',
  'Universiti Kebangsaan Malaysia',
  'Universiti Putra Malaysia',
  'Universiti Sains Malaysia',
  'Universiti Teknologi Malaysia',
  'Universiti Teknologi MARA',
  'Multimedia University',
  "Taylor's University",
  'Sunway University',
  'Asia Pacific University',
  'UCSI University',
  'Monash University Malaysia',
  'University of Nottingham Malaysia',
];

const FIELDS: readonly string[] = [
  'Computer Science',
  'Software Engineering',
  'Electrical & Electronic Engineering',
  'Mechanical Engineering',
  'Accounting',
  'Finance',
  'Business Administration',
  'Marketing',
  'Data Science',
  'Actuarial Science',
  'Chemical Engineering',
  'Psychology',
];

const SORT_FIELDS: readonly SortField[] = ['fullName', 'university', 'graduationYear', 'cgpa'];

const SEARCH_DEBOUNCE_MS = 300;

/** Matches the seed range: current year minus two, through next year. */
function graduationYears(): readonly number[] {
  const year = new Date().getFullYear();
  return [year - 2, year - 1, year, year + 1];
}

const CGPA_OPTIONS: readonly number[] = [2.5, 3.0, 3.3, 3.5, 3.7];

/**
 * Talent pool (flow F4).
 *
 * Every filter, the sort and the page live in the URL query string, so a
 * filtered view survives a refresh and can be pasted to a colleague. The URL
 * is the single source of truth: controls write to it, and one effect reads
 * it and loads. Nothing sets the store's filters directly, so the two can
 * never disagree.
 *
 * Search is debounced before it reaches the URL — a keystroke per request
 * would be 20+ requests for one word, and would also fill the browser history.
 */
@Component({
  selector: 'app-talent-pool-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterOutlet,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './talent-pool-page.component.html',
  styleUrl: './talent-pool-page.component.scss',
})
export default class TalentPoolPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly searchInput = new Subject<string>();

  protected readonly store = inject(TalentPoolStore);
  protected readonly shortlist = inject(ShortlistStore);

  protected readonly universities = UNIVERSITIES;
  protected readonly fields = FIELDS;
  protected readonly gradYears = graduationYears();
  protected readonly cgpaOptions = CGPA_OPTIONS;
  protected readonly columns = [
    'fullName',
    'university',
    'fieldOfStudy',
    'graduationYear',
    'cgpa',
    'skills',
    'actions',
  ];

  /** Shortlists are per fair, so without one there is nothing to add to. */
  protected readonly canShortlist = computed(() => this.auth.activeFairId() !== null);

  /** Local echo of the search box, so typing stays responsive while debounced. */
  protected readonly searchText = signal('');

  // Query params, bound by `withComponentInputBinding()`. They must be
  // `input()` rather than `signal()` — the router writes to inputs.
  readonly search = input<string | undefined>(undefined);
  readonly university = input<string | undefined>(undefined);
  readonly field = input<string | undefined>(undefined);
  readonly gradYear = input<string | undefined>(undefined);
  readonly minCgpa = input<string | undefined>(undefined);
  readonly sort = input<string | undefined>(undefined);
  readonly dir = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);

  private readonly debouncedSearch = toSignal(
    this.searchInput.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: null },
  );

  constructor() {
    // Reads the URL and loads. The only place that calls the store.
    effect(() => {
      const sortParam = this.sort();
      void this.store.load({
        ...DEFAULT_FILTERS,
        search: this.search() ?? '',
        university: this.university() ?? null,
        field: this.field() ?? null,
        gradYear: this.toNumber(this.gradYear()),
        minCgpa: this.toNumber(this.minCgpa()),
        sort: SORT_FIELDS.includes(sortParam as SortField)
          ? (sortParam as SortField)
          : DEFAULT_FILTERS.sort,
        dir: this.dir() === 'desc' ? 'desc' : 'asc',
        page: Math.max(1, this.toNumber(this.page()) ?? 1),
      });
    });

    // Keep the visible search box in step with the URL, including on a deep
    // link or a back navigation.
    effect(() => this.searchText.set(this.search() ?? ''));

    // Debounced typing lands in the URL, which the effect above then loads.
    effect(() => {
      const term = this.debouncedSearch();
      if (term !== null) {
        this.setParams({ search: term || null, page: null });
      }
    });

    // The shortlist drives the "already added" markers, and is scoped to the
    // active fair.
    effect(() => void this.shortlist.load(this.auth.activeFairId()));
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.searchInput.next(value);
  }

  protected setFilter(key: string, value: string | number | null): void {
    // mat-select hands back a number for the year and CGPA filters, but the
    // URL only holds strings. Any filter change also invalidates the page.
    this.setParams({ [key]: value === null ? null : String(value), page: null });
  }

  protected onSort(event: Sort): void {
    this.setParams({
      sort: event.direction ? event.active : null,
      dir: event.direction || null,
      page: null,
    });
  }

  protected onPage(event: PageEvent): void {
    this.setParams({ page: String(event.pageIndex + 1) });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected openCandidate(candidateId: string): void {
    // Query params are preserved so closing the drawer returns to the same
    // filtered page.
    void this.router.navigate(['/hiring/talent-pool', candidateId], {
      queryParamsHandling: 'preserve',
    });
  }

  protected retry(): void {
    void this.store.load(this.store.filters());
  }

  protected shortlistLabel(candidate: Candidate): string {
    if (!this.canShortlist()) {
      return 'Choose an active fair before shortlisting';
    }
    return this.shortlist.isShortlisted(candidate.id)
      ? `Remove ${candidate.fullName} from your shortlist`
      : `Add ${candidate.fullName} to your shortlist`;
  }

  /**
   * Adds or removes from the row, without opening the drawer first.
   *
   * `stopPropagation` matters: the row itself opens the profile, so without it
   * every shortlist click would also navigate.
   */
  protected async toggleShortlist(candidate: Candidate, event: Event): Promise<void> {
    event.stopPropagation();

    const fairId = this.auth.activeFairId();
    if (!fairId) {
      return;
    }

    const existing = this.shortlist.entryForCandidate(candidate.id);

    if (existing) {
      const error = await this.shortlist.remove(existing.id);
      if (error) {
        // The store has already put the entry back.
        this.announcer.announce(`Could not remove ${candidate.fullName}.`, 'assertive');
        this.snackBar.open(`Couldn't remove ${candidate.fullName}.`, 'Dismiss', {
          duration: 6000,
        });
        return;
      }
      this.announcer.announce(`${candidate.fullName} removed from your shortlist.`, 'polite');
      return;
    }

    const result = await this.shortlist.add(candidate.id, fairId, null);

    if (result.duplicate) {
      // Someone else's tab got there first. Not a failure — resync and say so.
      await this.shortlist.load(fairId);
      this.announcer.announce(`${candidate.fullName} is already on your shortlist.`, 'polite');
      return;
    }

    if (result.error) {
      this.announcer.announce(`Could not shortlist ${candidate.fullName}.`, 'assertive');
      const snack = this.snackBar.open(`Couldn't shortlist ${candidate.fullName}.`, 'Retry', {
        duration: 8000,
      });
      snack.onAction().subscribe(() => void this.toggleShortlist(candidate, new Event('click')));
      return;
    }

    this.announcer.announce(`${candidate.fullName} added to your shortlist.`, 'polite');
  }

  private setParams(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }

  private toNumber(value: string | undefined): number | null {
    if (value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
