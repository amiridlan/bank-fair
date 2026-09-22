import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../core/http/api.service';
import type { AuditEntry } from '../../core/models';
import { AuditStore } from './audit.store';

function entry(id: string, entity: AuditEntry['entity']): AuditEntry {
  return {
    id,
    at: '2026-09-22T20:00:00+08:00',
    actorId: 'u-staff-1',
    actorName: 'Farah Iskandar',
    actorRole: 'staff',
    action: 'updated',
    entity,
    entityId: `${entity}-1`,
    entityLabel: 'Something',
    method: 'PATCH',
    path: `/${entity}s/1`,
    changes: [],
  };
}

const ALL = [entry('a', 'employer'), entry('b', 'fair-application'), entry('c', 'employer')];

let requested: string[];
let failNext: boolean;

function makeStore(): AuditStore {
  requested = [];
  failNext = false;

  TestBed.configureTestingModule({
    providers: [
      {
        provide: ApiService,
        useValue: {
          getList: (path: string) => {
            requested.push(path);
            if (failNext) {
              return throwError(() => new Error('boom'));
            }
            const filtered = path.includes('entity=')
              ? ALL.filter((row) => path.includes(`entity=${row.entity}`))
              : ALL;
            return of({ data: filtered, meta: { total: filtered.length } });
          },
        },
      },
    ],
  });

  return TestBed.inject(AuditStore);
}

describe('AuditStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads everything by default', async () => {
    const store = makeStore();
    await store.load();

    expect(requested).toEqual(['/audit-entries']);
    expect(store.entries()).toHaveLength(3);
  });

  it('asks the API to filter, rather than filtering on the client', async () => {
    const store = makeStore();
    await store.load('employer');

    expect(requested).toEqual(['/audit-entries?entity=employer']);
    expect(store.entries()).toHaveLength(2);
  });

  it('keeps the filter options when a filter is applied', async () => {
    // Derived from what was on screen, choosing "Employer" left "Employer" as
    // the only option, so there was no way to switch to another kind without
    // going back through "Everything". What is in view is not what exists.
    const store = makeStore();
    await store.load();
    expect(store.availableEntities()).toEqual(['employer', 'fair-application']);

    await store.load('employer');

    expect(store.availableEntities()).toEqual(['employer', 'fair-application']);
  });

  it('reports an empty log as empty, not as an error', async () => {
    const store = makeStore();
    await store.load('booth');

    expect(store.isEmpty()).toBe(true);
    expect(store.hasError()).toBe(false);
  });

  it('sets an error signal rather than throwing', async () => {
    const store = makeStore();
    failNext = true;

    await store.load();

    expect(store.hasError()).toBe(true);
    expect(store.error()).not.toBeNull();
  });
});
