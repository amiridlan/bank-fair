import { ChangeDetectionStrategy, Component, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FairsStore } from '../fairs.store';
import FairOverviewTabComponent from './fair-overview-tab.component';

registerLocaleData(localeEnMY);

const FAIR = {
  id: 'fair-01',
  name: 'National Career Fair',
  venue: 'MITEC',
  city: 'Kuala Lumpur',
  start_date: '2026-10-14T09:00:00+08:00',
  end_date: '2026-10-15T18:00:00+08:00',
  status: 'open',
  booth_total: 40,
  booth_assigned: 16,
  registrations: 1905,
  check_ins: 0,
  created_at: '2026-06-01T10:00:00+08:00',
  updated_at: '2026-06-01T10:00:00+08:00',
};

function application(id: string, fairId: string, status = 'pending') {
  return {
    id,
    fair_id: fairId,
    employer_id: `emp-${id}`,
    employer_name: `Employer ${id}`,
    status,
    applied_at: '2026-09-18T10:00:00+08:00',
    decided_at: status === 'pending' ? null : '2026-09-19T10:00:00+08:00',
    decided_by: null,
    rejection_reason: null,
  };
}

function auditEntry(id: string, entityId: string, action = 'approved') {
  return {
    id,
    at: '2026-09-19T10:00:00+08:00',
    actor_id: 'u-staff-1',
    actor_name: 'Farah Iskandar',
    actor_role: 'staff',
    action,
    entity: 'fair-application',
    entity_id: entityId,
    entity_label: `Employer ${entityId}`,
    method: 'PATCH',
    path: `/fair-applications/${entityId}`,
    changes: [],
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FairOverviewTabComponent],
  template: `<app-fair-overview-tab />`,
})
class HostComponent {}

describe('FairOverviewTabComponent', () => {
  let http: HttpTestingController;

  async function render(
    applications: readonly ReturnType<typeof application>[],
    entries: readonly ReturnType<typeof auditEntry>[] = [],
  ) {
    // The parent shell loads the fair; this tab reads what it left behind, so
    // that has to have settled before the component renders.
    const store = TestBed.inject(FairsStore);
    const loaded = store.loadOne('fair-01');
    http.expectOne('/fairs/fair-01').flush({ data: FAIR });
    await loaded;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // ApplicationsStore.load() fetches both in parallel; loadRecent() adds one.
    http.expectOne('/fair-applications').flush({ data: applications });
    http.expectOne('/fairs').flush({ data: [FAIR] });
    http.expectOne('/audit-entries').flush({ data: entries });

    // ApplicationsStore.load() awaits a Promise.all of the two above, so its
    // status signal settles a microtask later than whenStable() alone waits
    // for. Without the macrotask the queue is still rendering "Loading…".
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('queues only the applications waiting on THIS fair', async () => {
    const el = await render([
      application('a1', 'fair-01'),
      application('a2', 'fair-02'), // another fair's queue
      application('a3', 'fair-01', 'approved'), // already decided
    ]);

    expect(el.textContent).toContain('Employer a1');
    expect(el.textContent).not.toContain('Employer a2');
    expect(el.textContent).not.toContain('Employer a3');
    expect(el.querySelectorAll('.queue__row')).toHaveLength(1);
  });

  it('says so rather than showing an empty box when the queue is clear', async () => {
    const el = await render([application('a2', 'fair-02')]);

    expect(el.querySelectorAll('.queue__row')).toHaveLength(0);
    expect(el.textContent).toContain('Every application for this fair has been decided');
  });

  it('scopes recent decisions to this fair by joining on its application ids', async () => {
    const el = await render(
      [application('a1', 'fair-01', 'approved'), application('a2', 'fair-02', 'approved')],
      [auditEntry('log-1', 'a1'), auditEntry('log-2', 'a2', 'rejected')],
    );

    const decisions = el.querySelector('.decisions')?.textContent ?? '';

    expect(decisions).toContain('Employer a1');
    // a2 belongs to fair-02, so its decision is not this fair's activity.
    expect(decisions).not.toContain('Employer a2');
  });

  it('renders booth fill as a progressbar carrying the real numbers', async () => {
    const el = await render([]);
    const meter = el.querySelector('[role="progressbar"][aria-label="Booth fill"]');

    expect(meter?.getAttribute('aria-valuenow')).toBe('16');
    expect(meter?.getAttribute('aria-valuemax')).toBe('40');
    expect(meter?.getAttribute('aria-valuetext')).toBe('16 of 40 booths assigned');
  });

  it('hides the check-in meter until the fair has actually started', async () => {
    const el = await render([]);

    // FAIR starts in October 2026; nobody can have checked in yet.
    expect(el.querySelector('[aria-label="Check-ins"]')).toBeNull();
  });
});
