import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { AuthStore } from './core/auth/auth.store';

/**
 * Smoke test over the real routes and shell.
 *
 * The narrow unit tests cover logic in isolation; this one catches the wiring
 * mistakes they cannot — a bad provider, a lazy chunk that fails to resolve, a
 * guard that redirects into a loop. If the app cannot render a route, this
 * fails rather than the deploy preview.
 *
 * It deliberately uses `appConfig.providers` rather than a hand-rolled test
 * setup: a copy would drift from the real configuration and stop testing it.
 * That is not hypothetical — the first draft of this file provided its own
 * router without `withComponentInputBinding()`, and the route-parameter test
 * failed against a config the app never actually uses.
 */
describe('App routing', () => {
  let router: Router;
  let auth: AuthStore;

  beforeEach(async () => {
    // AuthStore persists to sessionStorage, which outlives a TestBed.
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers],
    });

    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthStore);
  });

  it('renders the staff dashboard through the shell', async () => {
    auth.switchUser('u-staff-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/staff/dashboard']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('BankFair');
    expect(text).toContain('Dashboard');
  });

  it('sends a hiring manager who opens a staff URL back to their own home', async () => {
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/staff/employers']);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/hiring/talent-pool');
  });

  it('redirects the root path according to the active role', async () => {
    auth.switchUser('u-staff-1');
    TestBed.createComponent(AppComponent);

    await router.navigate(['/']);

    expect(router.url).toBe('/staff/dashboard');
  });

  it('renders the employer pipeline board with every column', async () => {
    auth.switchUser('u-staff-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/staff/employers']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const column of ['Lead', 'Proposal', 'Confirmed', 'Paid', 'Lost']) {
      expect(text).toContain(column);
    }
  });

  it('renders the floor plan grid for a fair', async () => {
    auth.switchUser('u-staff-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/staff/fairs/fair-01/floor-plan']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Floor plan');
    // Booth codes come from the seeded grid, so this also proves the two
    // parallel requests resolved and merged.
    expect(text).toContain('A-01');
  });

  it('renders the talent pool table for a hiring manager', async () => {
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/talent-pool']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Talent pool');
    expect(text).toContain('University');
    // 300 seeded candidates, 20 per page.
    expect(text).toContain('300');
  });

  it('shortlists from the table row without opening the drawer', async () => {
    // Triaging 300 candidates through the drawer was a three-step round trip
    // each (docs/07 UX-4), so the row carries the action itself.
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/talent-pool']);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector('tbody button[aria-pressed]') as HTMLButtonElement;
    const before = toggle.getAttribute('aria-pressed');

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-pressed')).not.toBe(before);
    // The row itself navigates, so the button must not: without
    // stopPropagation every shortlist click would also open the profile.
    expect(router.url).toBe('/hiring/talent-pool');
  });

  it('keeps every candidate row the same height', async () => {
    // Ragged rows had no rhythm to scan down (docs/07 UX-3). jsdom does not
    // lay out, so this asserts the structural cause instead: one line per
    // cell, every cell truncating rather than wrapping.
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/talent-pool']);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const wrapping = Array.from(host.querySelectorAll('tbody td')).filter(
      (cell) => (cell.textContent ?? '').trim().includes('\n'),
    );

    expect(wrapping).toHaveLength(0);
    // Long values stay reachable through the title attribute.
    expect(host.querySelector('tbody td .truncate')?.getAttribute('title')).toBeTruthy();
  });

  it('applies a filter taken from the URL query string', async () => {
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/talent-pool'], {
      queryParams: { field: 'Data Science' },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    // Every visible row must match, which is what makes the URL shareable.
    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'),
    ).map((row) => row.textContent ?? '');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((row) => row.includes('Data Science'))).toBe(true);
  });

  it('opens the candidate drawer from a deep link', async () => {
    auth.switchUser('u-hm-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/talent-pool', 'cand-001']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Skills');
    // Not shortlisted by emp-001, so contact stays locked.
    expect(text).toContain('Contact details unlock');
  });

  it('renders the interview slot grid for the active fair', async () => {
    auth.switchUser('u-hm-1');
    auth.setActiveFair('fair-01');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/interviews']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Interviews');
    // 21 twenty-minute slots between 10:00 and 17:00, three pre-booked in the seed.
    expect(text).toContain('Booked');
    expect(text).toContain('Open');
    expect(text).toContain('of 21 booked');
  });

  it('renders slot times in Malaysian time, not the viewer’s', async () => {
    auth.switchUser('u-hm-1');
    auth.setActiveFair('fair-01');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/hiring/interviews']);
    await fixture.whenStable();
    fixture.detectChanges();

    // Slots run 10:00–17:00 in Asia/Kuala_Lumpur. This suite runs in UTC, so
    // without DATE_PIPE_DEFAULT_OPTIONS the first slot would read 2:00 am —
    // which is exactly what it did before that provider existed.
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('10:00 am');
    expect(text).toContain('4:40 pm');
    expect(text).not.toContain('2:00 am');
  });

  it('shows the not-found page for an unknown URL', async () => {
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/no-such-page']);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Page not found');
  });

  it('binds a route parameter straight to a component input', async () => {
    auth.switchUser('u-staff-1');
    const fixture = TestBed.createComponent(AppComponent);

    await router.navigate(['/staff/fairs/fair-02']);
    await fixture.whenStable();
    fixture.detectChanges();

    // withComponentInputBinding() feeds :fairId into the page's input(), which
    // the store then loads — so the fair's own name appearing proves the whole
    // chain, not just that the id reached the template.
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('National Career Fair');
    expect(text).toContain('MITEC');
  });
});
