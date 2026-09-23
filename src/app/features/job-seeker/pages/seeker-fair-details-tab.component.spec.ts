import { ChangeDetectionStrategy, Component, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { JobSeekerStore } from '../job-seeker.store';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';
import SeekerFairDetailsTabComponent from './seeker-fair-details-tab.component';

registerLocaleData(localeEnMY);

/** Days from now, as an ISO string with the Kuala Lumpur offset. */
function isoIn(days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  return `${at.toISOString().slice(0, 19)}+08:00`;
}

function fair(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fair-01',
    name: 'KL Career Discovery Fair',
    venue: 'Sunway Pyramid',
    city: 'Petaling Jaya',
    description: 'Two days across three halls.',
    start_date: isoIn(14),
    end_date: isoIn(15),
    status: 'open',
    booth_total: 40,
    booth_assigned: 26,
    registrations: 2840,
    check_ins: 0,
    ...overrides,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeekerFairDetailsTabComponent],
  template: `<app-seeker-fair-details-tab />`,
})
class HostComponent {}

describe('SeekerFairDetailsTabComponent', () => {
  let http: HttpTestingController;

  async function render(
    fairRow: ReturnType<typeof fair>,
    registrations: readonly Record<string, unknown>[] = [],
  ): Promise<HTMLElement> {
    // The shell loads both stores before the tab renders.
    const detail = TestBed.inject(SeekerFairDetailStore);
    const seeker = TestBed.inject(JobSeekerStore);

    const detailDone = detail.load(String(fairRow['id']));
    http.expectOne(`/fairs/${fairRow['id']}`).flush({ data: fairRow });
    http.expectOne(`/fairs/${fairRow['id']}/exhibitors`).flush({ data: [] });
    http
      .expectOne((request) => request.url === `/fairs/${fairRow['id']}/job-openings`)
      .flush({ data: [] });
    await detailDone;

    const seekerDone = seeker.load('cand-001');
    http.expectOne('/fairs').flush({ data: [fairRow] });
    http.expectOne('/fair-registrations').flush({ data: registrations });
    http.expectOne('/candidates/cand-001').flush({ data: null });
    await seekerDone;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
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

  it('offers registration on a fair that is still ahead', async () => {
    const el = await render(fair());

    expect(el.textContent).toContain('Register for this fair');
    expect(el.textContent).not.toContain('You are registered');
  });

  it('does NOT offer registration on a fair that ended but was left open', async () => {
    // This is the fair-06 case in the seed: status still `open`, dates gone.
    // Status alone would invite someone to register for something that has
    // already happened.
    const el = await render(
      fair({ id: 'fair-06', start_date: isoIn(-8), end_date: isoIn(-7), status: 'open' }),
    );

    expect(el.textContent).not.toContain('Register for this fair');
    expect(el.textContent).toContain('Registration is closed');
  });

  it('shows when consent was given, not just that you are registered', async () => {
    const el = await render(fair(), [
      {
        id: 'reg-1',
        fair_id: 'fair-01',
        candidate_id: 'cand-001',
        registered_at: '2026-09-10T10:00:00+08:00',
        consented_at: '2026-09-10T10:00:00+08:00',
      },
    ]);

    expect(el.textContent).toContain('You are registered');
    // PDPA 2010: consent recorded at a point in time is why a registration is
    // a row rather than a flag, so the person can see when they gave it.
    expect(el.textContent).toContain('Consent given');
    expect(el.textContent).toContain('10/09/2026');
    expect(el.textContent).toContain('Withdraw');
  });

  it("ignores another fair's registration", async () => {
    const el = await render(fair(), [
      {
        id: 'reg-1',
        fair_id: 'fair-03',
        candidate_id: 'cand-001',
        registered_at: '2026-09-10T10:00:00+08:00',
        consented_at: '2026-09-10T10:00:00+08:00',
      },
    ]);

    expect(el.textContent).not.toContain('You are registered');
    expect(el.textContent).toContain('Register for this fair');
  });

  it('shows the description, which is the point of the tab', async () => {
    const el = await render(fair({ description: 'Weighted towards semiconductors.' }));

    expect(el.textContent).toContain('Weighted towards semiconductors.');
  });
});
