import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import type { Role } from '../models';
import { SideNavComponent } from './side-nav.component';

/** Only `role()` is read by the nav, so only `role()` is faked. */
function renderAs(role: Role): HTMLElement {
  TestBed.configureTestingModule({
    imports: [SideNavComponent],
    providers: [provideRouter([]), { provide: AuthStore, useValue: { role: signal(role) } }],
  });

  const fixture = TestBed.createComponent(SideNavComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/**
 * Reads the label span, not the link's textContent: a mat-icon renders its
 * name as a ligature, so textContent would be "dashboardDashboard".
 *
 * Scoped to the main list. Settings lives in a second list pinned to the
 * bottom, and folding it into these expectations would hide which list a
 * link actually landed in.
 */
function labels(host: HTMLElement): string[] {
  const main = host.querySelector('.nav__list:not(.nav__list--end)');
  return Array.from(main?.querySelectorAll('.nav__label') ?? []).map((el) =>
    (el.textContent ?? '').trim(),
  );
}

/** The bottom section: label and route. */
function endSection(host: HTMLElement): { label: string; href: string | null }[] {
  const end = host.querySelector('.nav__list--end');
  return Array.from(end?.querySelectorAll('a') ?? []).map((link) => ({
    label: (link.querySelector('.nav__label')?.textContent ?? '').trim(),
    href: link.getAttribute('href'),
  }));
}

describe('SideNavComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists the staff routes for staff', () => {
    expect(labels(renderAs('staff'))).toEqual([
      'Dashboard',
      'Fairs',
      'Employers',
      'Registrations',
    ]);
  });

  it('lists the hiring routes for an employer', () => {
    expect(labels(renderAs('employer'))).toEqual([
      'Talent pool',
      'Shortlist',
      'Interviews',
      'Fairs',
    ]);
  });

  it('lists the portal routes for a job seeker', () => {
    // The nav used to be `isStaff() ? STAFF_NAV : EMPLOYER_NAV`. That is fine
    // with two roles and silently wrong with three — a job seeker would have
    // been handed the employer's menu, every link of which roleGuard blocks.
    // A record over `Role` makes the compiler name a forgotten role instead.
    expect(labels(renderAs('job_seeker'))).toEqual(['Career fairs', 'My profile']);
  });

  it('pins Settings to the bottom for every role', () => {
    for (const role of ['staff', 'employer', 'job_seeker'] as const) {
      TestBed.resetTestingModule();
      expect(endSection(renderAs(role)).map((item) => item.label)).toEqual(['Settings']);
    }
  });

  it('sends each role to the settings route its own guard allows', () => {
    // One page, three routes, because each role's section sits behind its own
    // roleGuard. Pointing them all at one would 404 two of the three.
    const routes = (['staff', 'employer', 'job_seeker'] as const).map((role) => {
      TestBed.resetTestingModule();
      return endSection(renderAs(role))[0].href;
    });

    expect(routes).toEqual(['/staff/settings', '/hiring/settings', '/me/settings']);
  });

  it('keeps Settings out of the main menu', () => {
    // It is deliberately away from the working pages; if it leaks back into
    // the main list this is the test that says so.
    expect(labels(renderAs('staff'))).not.toContain('Settings');
  });

  it('gives each role a menu of its own', () => {
    const menus = (['staff', 'employer', 'job_seeker'] as const).map((role) => {
      // A TestBed can only be configured once, and this renders three.
      TestBed.resetTestingModule();
      return labels(renderAs(role)).join();
    });

    expect(new Set(menus).size).toBe(3);
  });
});
