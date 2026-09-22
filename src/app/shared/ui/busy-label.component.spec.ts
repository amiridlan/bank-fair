import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BusyLabelComponent } from './busy-label.component';

/**
 * The host drives the input with a signal. The app is zoneless, so a plain
 * field reassigned in a test does not tell Angular anything has changed and
 * the binding never re-runs.
 */
@Component({
  imports: [BusyLabelComponent],
  template: `<app-busy-label [busy]="busy()">Approve</app-busy-label>`,
})
class HostComponent {
  readonly busy = signal(false);
}

function render() {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('BusyLabelComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows no spinner when idle', () => {
    const fixture = render();

    expect(fixture.nativeElement.querySelector('.fo-spinner')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-busy-label').getAttribute('aria-busy')).toBeNull();
  });

  it('shows a spinner and marks itself busy', () => {
    const fixture = render();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fo-spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-busy-label').getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('keeps the label in the DOM while busy', () => {
    // Faded, not removed. The width stays so the button does not resize under
    // the pointer, and the text stays in the accessibility tree so the button
    // keeps its name.
    const fixture = render();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.label') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Approve');
    expect(label.classList.contains('label--busy')).toBe(true);
  });

  it('hides the spinner from assistive technology', () => {
    // The state is already carried by aria-busy; announcing a decorative ring
    // as well would say it twice.
    const fixture = render();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.fo-spinner').getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
