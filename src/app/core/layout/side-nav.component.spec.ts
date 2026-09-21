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
 */
function labels(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('.nav__label')).map((el) => (el.textContent ?? '').trim());
}

describe('SideNavComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists the staff routes for staff', () => {
    expect(labels(renderAs('staff'))).toEqual(['Dashboard', 'Fairs', 'Employers']);
  });

  it('lists the hiring routes for an employer', () => {
    expect(labels(renderAs('employer'))).toEqual(['Talent pool', 'Shortlist', 'Interviews']);
  });

  it('lists the portal routes for a job seeker', () => {
    // The nav used to be `isStaff() ? STAFF_NAV : EMPLOYER_NAV`. That is fine
    // with two roles and silently wrong with three — a job seeker would have
    // been handed the employer's menu, every link of which roleGuard blocks.
    // A record over `Role` makes the compiler name a forgotten role instead.
    expect(labels(renderAs('job_seeker'))).toEqual(['Career fairs', 'My profile']);
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
