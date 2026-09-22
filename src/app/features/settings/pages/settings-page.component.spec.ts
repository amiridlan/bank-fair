import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { ApiService } from '../../../core/http/api.service';
import { DemoSettingsService } from '../../../core/mock-api/demo-settings.service';
import type { Role, User } from '../../../core/models';
import SettingsPageComponent from './settings-page.component';

const STAFF: User = {
  id: 'u-staff-1',
  name: 'Farah Iskandar',
  role: 'staff',
  employerId: null,
  candidateId: null,
};

let dialogResult: boolean;
let postCalls: string[];

function render(user: User = STAFF, role: Role = 'staff') {
  dialogResult = false;
  postCalls = [];

  TestBed.configureTestingModule({
    imports: [SettingsPageComponent],
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { user: signal(user), role: signal(role) } },
      {
        provide: ApiService,
        useValue: {
          postVoid: (path: string) => {
            postCalls.push(path);
            return EMPTY;
          },
        },
      },
      {
        provide: MatDialog,
        useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) },
      },
    ],
  });

  const fixture = TestBed.createComponent(SettingsPageComponent);
  fixture.detectChanges();
  return fixture;
}

const text = (fixture: { nativeElement: HTMLElement }) =>
  (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');

describe('SettingsPageComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names the current demo identity and role', () => {
    // One render per test: a TestBed cannot be configured twice.
    const rendered = text(render());

    expect(rendered).toContain('Farah Iskandar');
    expect(rendered).toContain('Staff');
  });

  it('says on the page that this is a demo, not a sign-in', () => {
    // The warning belongs where someone can read it, not only in a comment.
    expect(text(render())).toContain('demo identity, not a sign-in');
  });

  it('reflects the simulated-error switch', () => {
    const fixture = render();
    const demo = TestBed.inject(DemoSettingsService);

    demo.setSimulatedErrors(true);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle [role="switch"]');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
  });

  it('asks before resetting, and does nothing if the answer is no', async () => {
    // The menu version reset on a single click. It throws away the whole
    // session and cannot be undone, so it asks now.
    const fixture = render();
    dialogResult = false;

    fixture.nativeElement.querySelector('button[matButton="outlined"]')?.click();
    await Promise.resolve();

    expect(postCalls).toEqual([]);
  });

  it('resets once confirmed', async () => {
    const fixture = render();
    dialogResult = true;

    fixture.nativeElement.querySelector('button[matButton="outlined"]')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(postCalls).toEqual(['/demo/reset']);
  });

  it('labels the role for a job seeker too', () => {
    const seeker: User = { ...STAFF, name: 'Ahmad Zaki', role: 'job_seeker', candidateId: 'cand-001' };

    expect(text(render(seeker, 'job_seeker'))).toContain('Job seeker');
  });
});
