import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/http/api.service';
import { type ApiError, toApiError } from '../../../core/http/api-error';
import { DemoSettingsService } from '../../../core/mock-api/demo-settings.service';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

interface DemoCounts {
  readonly users: number;
  readonly fairs: number;
  readonly booths: number;
  readonly employers: number;
  readonly candidates: number;
  readonly shortlists: number;
  readonly interviewSlots: number;
}

/** What docs/05 says each table should hold, so a drift is obvious. */
const EXPECTED: Readonly<Record<keyof DemoCounts, string>> = {
  users: '3',
  fairs: '5',
  booths: '200 (40 × 5 fairs)',
  employers: '60',
  candidates: '300',
  shortlists: '6',
  interviewSlots: '126 (21 × 2 employers × 3 fairs)',
};

/**
 * TODO(Phase 6): delete this page, its route, and the `/demo/counts` handler.
 *
 * It exists only so the seed data can be verified on the Netlify deploy
 * preview — the developer has no local machine and cannot open a console.
 */
@Component({
  selector: 'app-debug-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, ErrorStateComponent, PageHeaderComponent, SkeletonComponent],
  template: `
    <app-page-header
      title="Debug — seed data"
      description="Temporary page for verifying the mock database. Removed in Phase 6."
    >
      <button slot="actions" matButton="outlined" type="button" (click)="load()">Reload</button>
    </app-page-header>

    @if (status() === 'loading') {
      <app-skeleton [count]="7" [height]="40" label="Loading record counts" />
    } @else if (status() === 'error') {
      <app-error-state [error]="error()" (retry)="load()" />
    } @else if (counts(); as data) {
      <table class="counts">
        <caption class="fo-sr-only">Record counts per table, with the expected value</caption>
        <thead>
          <tr>
            <th scope="col">Table</th>
            <th scope="col">Rows</th>
            <th scope="col">Expected</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(data); track row.key) {
            <tr>
              <th scope="row">{{ row.key }}</th>
              <td class="fo-tabular">{{ row.value }}</td>
              <td class="fo-caption">{{ row.expected }}</td>
            </tr>
          }
        </tbody>
      </table>

      <p class="fo-caption">
        Simulated errors are {{ demoSettings.simulateErrors() ? 'ON' : 'OFF' }}. Toggle them from
        the user menu, or open the app with <code>?simulateErrors=1</code>.
      </p>
    }
  `,
  styles: `
    .counts {
      width: 100%;
      max-width: 640px;
      border-collapse: collapse;
      background: var(--fo-surface-raised);
      border: 1px solid var(--fo-border);
      border-radius: var(--fo-radius-md);
    }

    .counts th,
    .counts td {
      padding: var(--fo-space-3);
      text-align: left;
      border-bottom: 1px solid var(--fo-border);
    }

    .counts tbody tr:last-child th,
    .counts tbody tr:last-child td {
      border-bottom: none;
    }
  `,
})
export default class DebugPageComponent {
  private readonly api = inject(ApiService);

  protected readonly demoSettings = inject(DemoSettingsService);
  protected readonly counts = signal<DemoCounts | null>(null);
  protected readonly status = signal<'loading' | 'success' | 'error'>('loading');
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    void this.load();
  }

  protected rows(
    data: DemoCounts,
  ): readonly { key: string; value: number; expected: string }[] {
    return (Object.keys(EXPECTED) as (keyof DemoCounts)[]).map((key) => ({
      key,
      value: data[key],
      expected: EXPECTED[key],
    }));
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      this.counts.set(await firstValueFrom(this.api.get<DemoCounts>('/demo/counts')));
      this.status.set('success');
    } catch (err: unknown) {
      this.error.set(toApiError(err));
      this.status.set('error');
    }
  }
}
