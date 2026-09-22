import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  type Event as RouterEvent,
} from '@angular/router';

import { RouteProgressComponent } from './route-progress.component';

const events = new Subject<RouterEvent>();

function render() {
  TestBed.configureTestingModule({
    imports: [RouteProgressComponent],
    providers: [provideRouter([]), { provide: Router, useValue: { events } }],
  });
  const fixture = TestBed.createComponent(RouteProgressComponent);
  fixture.detectChanges();
  return fixture;
}

const bar = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('[role="progressbar"]');

describe('RouteProgressComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows nothing until a navigation starts', () => {
    expect(bar(render())).toBeNull();
  });

  it('appears while navigating', () => {
    const fixture = render();
    events.next(new NavigationStart(1, '/staff/fairs'));
    fixture.detectChanges();

    expect(bar(fixture)).not.toBeNull();
    expect(bar(fixture)?.getAttribute('aria-label')).toBe('Loading page');
  });

  it('gives no aria-valuenow, because the router cannot say how far through it is', () => {
    const fixture = render();
    events.next(new NavigationStart(1, '/staff/fairs'));
    fixture.detectChanges();

    expect(bar(fixture)?.getAttribute('aria-valuenow')).toBeNull();
  });

  it.each([
    ['ends', new NavigationEnd(1, '/a', '/a')],
    // A guard redirect cancels rather than ends. Without this the bar would
    // be stranded on screen for the rest of the session.
    ['is cancelled', new NavigationCancel(1, '/a', 'blocked')],
    ['fails', new NavigationError(1, '/a', new Error('chunk failed'))],
  ])('disappears when the navigation %s', (_label, event) => {
    const fixture = render();
    events.next(new NavigationStart(1, '/a'));
    fixture.detectChanges();
    expect(bar(fixture)).not.toBeNull();

    events.next(event);
    fixture.detectChanges();

    expect(bar(fixture)).toBeNull();
  });
});
