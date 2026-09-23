import { ChangeDetectionStrategy, Component, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { JobSeekerStore } from '../job-seeker.store';
import { SeekerFairDetailStore } from '../seeker-fair-detail.store';
import SeekerFairJobsTabComponent from './seeker-fair-jobs-tab.component';

registerLocaleData(localeEnMY);

function opening(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    employer_id: 'emp-001',
    employer_name: 'Gemilang Software Sdn Bhd',
    booth_code: 'A-04',
    fair_ids: ['fair-01'],
    title: `Role ${id}`,
    job_function: 'Engineering',
    employment_type: 'full_time',
    experience_level: 'fresh_graduate',
    location: 'Kuala Lumpur',
    skills: ['TypeScript', 'Testing'],
    salary_min_myr: 3000,
    salary_max_myr: 4500,
    headcount: 1,
    posted_at: '2026-09-10T10:00:00+08:00',
    ...overrides,
  };
}

const PROFILE = {
  id: 'cand-001',
  full_name: 'Ahmad Zaki',
  email: 'a***@example.com',
  phone: null,
  university: 'UTM',
  field_of_study: 'Software Engineering',
  qualification: 'degree',
  graduation_year: 2027,
  cgpa: 3.4,
  skills: ['TypeScript', 'React'],
  headline: 'Final-year student',
  fair_ids: [],
  is_contact_visible: false,
  created_at: '2026-01-01T10:00:00+08:00',
  updated_at: '2026-01-01T10:00:00+08:00',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeekerFairJobsTabComponent],
  template: `<app-seeker-fair-jobs-tab />`,
})
class HostComponent {}

describe('SeekerFairJobsTabComponent', () => {
  let http: HttpTestingController;

  /** Returns the fixture so a test can re-render after interacting. */
  async function mount(
    openings: readonly ReturnType<typeof opening>[],
    profile: unknown = PROFILE,
  ) {
    const detail = TestBed.inject(SeekerFairDetailStore);
    const seeker = TestBed.inject(JobSeekerStore);

    const detailDone = detail.load('fair-01');
    http.expectOne('/fairs/fair-01').flush({ data: { id: 'fair-01', name: 'A fair' } });
    http.expectOne('/fairs/fair-01/exhibitors').flush({ data: [] });
    http
      .expectOne((request) => request.url === '/fairs/fair-01/job-openings')
      .flush({ data: openings });
    await detailDone;

    const seekerDone = seeker.load('cand-001');
    http.expectOne('/fairs').flush({ data: [] });
    http.expectOne('/fair-registrations').flush({ data: [] });
    http.expectOne('/candidates/cand-001').flush({ data: profile });
    await seekerDone;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function render(
    openings: readonly ReturnType<typeof opening>[],
    profile: unknown = PROFILE,
  ): Promise<HTMLElement> {
    return (await mount(openings, profile)).nativeElement as HTMLElement;
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

  it('lists every role at the fair', async () => {
    const el = await render([opening('job-1'), opening('job-2')]);

    expect(el.querySelectorAll('app-job-opening-card')).toHaveLength(2);
    expect(el.textContent).toContain('Showing 2 of 2 roles');
  });

  it('shows a salary range when there is one, and says so when there is not', async () => {
    const el = await render([
      opening('job-1'),
      opening('job-2', { salary_min_myr: null, salary_max_myr: null }),
    ]);

    expect(el.textContent).toContain('3,000');
    expect(el.textContent).toContain('4,500');
    // Not a blank where a figure belongs — that reads as a rendering fault
    // rather than as a choice the employer made (docs/11 J-D5).
    expect(el.textContent).toContain('Salary not disclosed');
  });

  it('marks the roles matching skills on the profile', async () => {
    const el = await render([
      // Profile has TypeScript and React.
      opening('job-1', { skills: ['TypeScript', 'Docker'] }),
      opening('job-2', { skills: ['MATLAB', 'Verilog'] }),
    ]);

    expect(el.textContent).toContain('Matches 1 skill on your profile');
    expect(el.querySelectorAll('.card--matched')).toHaveLength(1);
    expect(el.textContent).toContain('Matches my skills (1)');
  });

  it('counts every overlapping skill, not just the first', async () => {
    const el = await render([opening('job-1', { skills: ['TypeScript', 'React', 'Docker'] })]);

    expect(el.textContent).toContain('Matches 2 skills on your profile');
  });

  it('hides the match filter and explains why when the profile has no skills', async () => {
    const el = await render([opening('job-1')], { ...PROFILE, skills: [] });

    expect(el.textContent).not.toContain('Matches my skills');
    expect(el.textContent).toContain('Add skills to your profile');
  });

  it('filters to the roles that match', async () => {
    const fixture = await mount([
      opening('job-1', { title: 'Frontend Engineer', skills: ['TypeScript'] }),
      opening('job-2', { title: 'Wafer Engineer', skills: ['MATLAB'] }),
    ]);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Wafer Engineer');

    const toggle = [...el.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Matches my skills'),
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('Frontend Engineer');
    expect(el.textContent).not.toContain('Wafer Engineer');
    expect(el.textContent).toContain('Showing 1 of 2 roles');
  });

  it('filters by employment type', async () => {
    const fixture = await mount([
      opening('job-1', { title: 'Graduate Engineer', employment_type: 'full_time' }),
      opening('job-2', { title: 'Summer Intern', employment_type: 'internship' }),
    ]);
    const el = fixture.nativeElement as HTMLElement;

    // Driving the mat-select through the DOM needs an overlay; setting the
    // signal is the same code path the template's (valueChange) uses.
    const tab = fixture.debugElement.query(
      (node) => node.name === 'app-seeker-fair-jobs-tab',
    ).componentInstance as { type: { set: (value: string) => void } };
    tab.type.set('internship');
    fixture.detectChanges();

    expect(el.textContent).toContain('Summer Intern');
    expect(el.textContent).not.toContain('Graduate Engineer');
  });

  it('is empty-stated when the fair has no roles at all', async () => {
    const el = await render([]);

    expect(el.textContent).toContain('No roles listed yet');
    expect(el.querySelector('.filters')).toBeNull();
  });
});
