import { ChangeDetectionStrategy, Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import FairEmployersTabComponent from './fair-employers-tab.component';

registerLocaleData(localeEnMY);

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Employer ${id}`,
    industry: 'Technology',
    company_size: '51-200',
    stage: 'confirmed',
    lost_reason: null,
    contact_name: 'Aisyah Rahman',
    contact_email: `${id}@example.com`,
    contact_phone: null,
    booth_package: 'premium',
    deal_value_myr: 7500,
    fair_ids: ['fair-01'],
    notes: null,
    created_at: '2026-06-01T10:00:00+08:00',
    updated_at: '2026-06-01T10:00:00+08:00',
    ...overrides,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FairEmployersTabComponent],
  template: `<app-fair-employers-tab [fairId]="fairId()" />`,
})
class HostComponent {
  readonly fairId = signal('fair-01');
}

describe('FairEmployersTabComponent', () => {
  let http: HttpTestingController;

  /** Renders the tab and answers the one /employers request it makes. */
  async function render(rows: readonly ReturnType<typeof row>[]) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/employers').flush({ data: rows });
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'en-MY' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists only the employers tagged with this fair', async () => {
    const el = (
      await render([
        row('emp-001', { name: 'Attending Berhad' }),
        row('emp-002', { name: 'Elsewhere Berhad', fair_ids: ['fair-02'] }),
      ])
    ).nativeElement as HTMLElement;

    expect(el.textContent).toContain('Attending Berhad');
    expect(el.textContent).not.toContain('Elsewhere Berhad');
  });

  it('counts the pipeline and the committed total, excluding lost deals', async () => {
    const el = (
      await render([
        row('emp-001'), // confirmed, 7500
        row('emp-002', { stage: 'paid' }), // 7500
        row('emp-003', { stage: 'proposal' }), // 7500, not yet won
        // A lost deal is still in the pipeline history but is worth nothing.
        row('emp-004', { stage: 'lost', lost_reason: 'Budget', deal_value_myr: 99000 }),
      ])
    ).nativeElement as HTMLElement;

    const summary = el.querySelector('.summary__text')?.textContent ?? '';

    expect(summary).toContain('4');
    expect(summary).toContain('2'); // confirmed or paid
    expect(summary).toContain('22,500');
    expect(summary).not.toContain('99,000');
  });

  it('shows an empty state when no employer is tagged with this fair', async () => {
    const el = (await render([row('emp-001', { fair_ids: ['fair-09'] })]))
      .nativeElement as HTMLElement;

    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No employers in the pipeline for this fair');
  });

  it('renders an em dash rather than RM 0 for an employer with no deal value', async () => {
    // A lead has no proposal yet, so its value is unknown — not zero.
    const el = (await render([row('emp-001', { stage: 'lead', deal_value_myr: null })]))
      .nativeElement as HTMLElement;

    const valueCell = el.querySelectorAll('td')[3];

    expect(valueCell.textContent?.trim()).toBe('—');
  });
});
