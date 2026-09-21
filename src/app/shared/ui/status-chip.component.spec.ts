import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { EmployerStage, FairStatus } from '../../core/models';
import { StatusChipComponent } from './status-chip.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusChipComponent],
  template: `<app-status-chip [kind]="kind" [status]="status" />`,
})
class HostComponent {
  kind: 'fair' | 'employer' = 'fair';
  status: FairStatus | EmployerStage = 'open';
}

function render(kind: 'fair' | 'employer', status: FairStatus | EmployerStage): HTMLElement {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.kind = kind;
  fixture.componentInstance.status = status;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/**
 * These guard the rule in docs/03 that status is never conveyed by colour
 * alone — a chip must always carry a readable label and an icon.
 */
describe('StatusChipComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  const fairCases: readonly [FairStatus, string, string][] = [
    ['draft', 'Draft', 'edit_note'],
    ['open', 'Open', 'event_available'],
    ['live', 'Live', 'sensors'],
    ['completed', 'Completed', 'task_alt'],
  ];

  const employerCases: readonly [EmployerStage, string, string][] = [
    ['lead', 'Lead', 'person_search'],
    ['proposal', 'Proposal', 'description'],
    ['confirmed', 'Confirmed', 'handshake'],
    ['paid', 'Paid', 'paid'],
    ['lost', 'Lost', 'block'],
  ];

  it('gives every fair status a label and an icon', () => {
    for (const [status, label, icon] of fairCases) {
      const el = render('fair', status);
      expect(el.textContent).toContain(label);
      expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
    }
  });

  it('gives every employer stage a label and an icon', () => {
    for (const [status, label, icon] of employerCases) {
      const el = render('employer', status);
      expect(el.textContent).toContain(label);
      expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
    }
  });

  it('hides the icon from assistive tech, since the label already says it', () => {
    const el = render('employer', 'paid');
    expect(el.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses ink text on the accent background for the Live chip', () => {
    // The accent is 2.1:1 on white, so it is a background only — pairing it
    // with ink gives 7.4:1.
    const chip = render('fair', 'live').querySelector('.chip') as HTMLElement;

    expect(chip.style.color).toContain('--fo-ink');
    expect(chip.style.backgroundColor).toContain('--fo-accent');
  });

  it('falls back to a readable chip for an unknown status', () => {
    // Defensive: a new stage added server-side must not render a blank chip.
    const el = render('employer', 'something-new' as EmployerStage);

    expect(el.textContent).toContain('Unknown');
    expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('help_outline');
  });
});
