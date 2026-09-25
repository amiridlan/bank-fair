import { ChangeDetectionStrategy, Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FairCandidatesStore } from '../fair-candidates.store';
import FairCandidatesTabComponent from './fair-candidates-tab.component';

registerLocaleData(localeEnMY);

function candidate(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    full_name: `Candidate ${id}`,
    university: 'Universiti Teknologi Malaysia',
    field_of_study: 'Software Engineering',
    qualification: 'degree',
    graduation_year: 2027,
    cgpa: 3.4,
    skills: ['TypeScript'],
    headline: 'Final-year Software Engineering student, interested in backend systems',
    // Already masked by the API for a staff viewer.
    email: 'c***@example.com',
    phone: null,
    is_contact_visible: false,
    fair_ids: ['fair-01'],
    ...overrides,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FairCandidatesTabComponent],
  template: `<app-fair-candidates-tab [fairId]="fairId()" />`,
})
class HostComponent {
  readonly fairId = signal('fair-01');
}

describe('FairCandidatesTabComponent', () => {
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

  async function render(rows: readonly ReturnType<typeof candidate>[], total = rows.length) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // A predicate, not a string: the request carries fair_id and paging.
    const request = http.expectOne((r) => r.url === '/candidates');
    // The scoping is the whole point of the tab, so assert it is asked for.
    expect(request.request.params.get('fair_id')).toBe('fair-01');
    request.flush({
      data: rows,
      meta: { current_page: 1, per_page: 25, total, last_page: Math.ceil(total / 25) || 1 },
    });

    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture;
  }

  it('shows a skeleton rather than another fair\'s rows while loading', async () => {
    // The store is a singleton, so it may already hold a different fair's
    // registrants when this tab mounts — from the last fair the user looked at.
    const store = TestBed.inject(FairCandidatesStore);
    const preload = store.load('fair-02');
    http
      .expectOne((r) => r.url === '/candidates')
      .flush({
        data: [candidate('cand-099', { fair_ids: ['fair-02'] })],
        meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
      });
    await preload;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Before fair-01's response lands, fair-02's rows must not appear under
    // fair-01's heading.
    expect(el.textContent).not.toContain('Candidate cand-099');
    expect(el.querySelector('app-skeleton')).not.toBeNull();

    http.expectOne((r) => r.url === '/candidates').flush({
      data: [candidate('cand-001')],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(el.textContent).toContain('Candidate cand-001');
  });

  it('lists the candidates registered for this fair', async () => {
    const el = (await render([candidate('cand-001'), candidate('cand-002')]))
      .nativeElement as HTMLElement;

    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('Candidate cand-001');
    expect(el.textContent).toContain('2 registered');
  });

  it('has no contact column, because every value would be the same mask', async () => {
    const el = (await render([candidate('cand-001')])).nativeElement as HTMLElement;
    const headers = [...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim());

    expect(headers).toEqual(['Name', 'University', 'Field', 'Graduating', 'CGPA']);
    // The rule is stated once instead, with an example, so a reader knows the
    // masking is deliberate rather than missing data.
    expect(el.textContent).toContain('Contact details are masked');
    expect(el.textContent).toContain('a***@example.com');
  });

  it('says nobody has registered rather than showing an empty table', async () => {
    const el = (await render([])).nativeElement as HTMLElement;

    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('Nobody has registered yet');
  });

  it('shows a dash for a candidate with no CGPA', async () => {
    const el = (await render([candidate('cand-001', { cgpa: null })])).nativeElement as HTMLElement;

    expect(el.textContent).toContain('—');
  });

  it('does not show one fair\'s registrants under another fair\'s heading', async () => {
    const fixture = await render([candidate('cand-001')]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Candidate cand-001');

    fixture.componentInstance.fairId.set('fair-02');
    fixture.detectChanges();

    // The store is a singleton and still holds fair-01's rows until the new
    // request lands, so the tab must show a skeleton rather than the old list.
    expect(el.textContent).not.toContain('Candidate cand-001');
    expect(el.querySelector('app-skeleton')).not.toBeNull();

    const request = http.expectOne((r) => r.url === '/candidates');
    expect(request.request.params.get('fair_id')).toBe('fair-02');
    request.flush({
      data: [candidate('cand-009', { fair_ids: ['fair-02'] })],
      meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(el.textContent).toContain('Candidate cand-009');
  });
});
