import { ChangeDetectionStrategy, Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import SeekerFairDetailPageComponent from './seeker-fair-detail-page.component';

registerLocaleData(localeEnMY);

function fairRow(id: string, name: string) {
  return {
    id,
    name,
    venue: 'MITEC',
    city: 'Kuala Lumpur',
    description: 'A fair.',
    start_date: '2026-10-14T09:00:00+08:00',
    end_date: '2026-10-15T18:00:00+08:00',
    status: 'open',
    booth_total: 40,
    booth_assigned: 16,
    registrations: 1905,
    check_ins: 0,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeekerFairDetailPageComponent],
  template: `<app-seeker-fair-detail-page [fairId]="fairId()" />`,
})
class HostComponent {
  // A signal, not a plain field: this app is zoneless, so a plain assignment
  // would not drive a signal input.
  readonly fairId = signal('fair-01');
}

describe('SeekerFairDetailPageComponent', () => {
  let http: HttpTestingController;

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

  /**
   * Answers the requests the shell fires, then settles.
   *
   * `alsoSeeker` is false on a second navigation: the seeker store loads from
   * an effect keyed on the candidate id, which has not changed, so only the
   * detail store refetches.
   */
  async function settle(
    fixture: ReturnType<typeof TestBed.createComponent>,
    id: string,
    row: unknown,
    alsoSeeker = true,
  ) {
    if (row === null) {
      http
        .expectOne(`/fairs/${id}`)
        .flush({ message: 'Fair not found.' }, { status: 404, statusText: 'Not Found' });
    } else {
      http.expectOne(`/fairs/${id}`).flush({ data: row });
    }
    http.expectOne(`/fairs/${id}/exhibitors`).flush({ data: [] });
    if (alsoSeeker) {
      http.expectOne('/fairs').flush({ data: [] });
      http.expectOne('/fair-registrations').flush({ data: [] });
    }

    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('shows the error state when the fair cannot be loaded', async () => {
    // The regression this guards: a failed load clears `loadedId`, so the
    // staleness check `!isCurrent()` stays true afterwards. With the skeleton
    // tested before the error, a 404 sat on a loading skeleton for ever and
    // the Retry button was unreachable.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture, 'fair-01', null);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Couldn't load this fair");
    expect(el.querySelector('app-skeleton')).toBeNull();
  });

  it('renders the fair once it arrives', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture, 'fair-01', fairRow('fair-01', 'National Career Fair'));

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('National Career Fair');
    expect(el.textContent).toContain('Employers (0)');
  });

  it('does not show one fair under another fair\'s heading', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await settle(fixture, 'fair-01', fairRow('fair-01', 'National Career Fair'));

    // Navigate. The store is a singleton, so it still holds fair-01 until the
    // new request lands — the shell must show a skeleton, not the old fair.
    fixture.componentInstance.fairId.set('fair-02');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('National Career Fair');
    expect(el.querySelector('app-skeleton')).not.toBeNull();

    await settle(fixture, 'fair-02', fairRow('fair-02', 'Northern Tech Fair'), false);
    expect(el.textContent).toContain('Northern Tech Fair');
  });
});
