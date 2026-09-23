import { ChangeDetectionStrategy, Component, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEnMY from '@angular/common/locales/en-MY';
import { TestBed } from '@angular/core/testing';

import { KpiCardComponent } from './kpi-card.component';

registerLocaleData(localeEnMY);

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KpiCardComponent],
  template: `
    <app-kpi-card
      [label]="label"
      [value]="value"
      [prefix]="prefix"
      [suffix]="suffix"
      [deltaPct]="deltaPct"
      [higherIsBetter]="higherIsBetter"
    />
  `,
})
class HostComponent {
  label = 'Pipeline value';
  value = 214500;
  prefix: string | null = null;
  suffix: string | null = null;
  deltaPct: number | null = null;
  higherIsBetter = true;
}

function render(setup: Partial<HostComponent> = {}): HTMLElement {
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, setup);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('KpiCardComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'en-MY' }],
    }),
  );

  it('groups large numbers', () => {
    expect(render().textContent).toContain('214,500');
  });

  it('renders a prefix and suffix around the value', () => {
    expect(render({ value: 65, suffix: '%' }).textContent).toContain('65');
    expect(render({ value: 3500, prefix: 'RM ' }).textContent).toContain('RM ');
  });

  it('omits the delta entirely when there is no baseline', () => {
    const el = render({ deltaPct: null });

    // Showing 0% would imply "no change", which is not the same as "unknown".
    expect(el.querySelector('.kpi__delta')).toBeNull();
  });

  describe('delta direction', () => {
    it('shows an up arrow in success colour for a good rise', () => {
      const el = render({ deltaPct: 0.76 });
      const delta = el.querySelector('.kpi__delta') as HTMLElement;

      // Direction is carried by the arrow as well as the colour, so it
      // survives for anyone who cannot distinguish green from red.
      expect(delta.querySelector('mat-icon')?.textContent?.trim()).toBe('arrow_upward');
      expect(delta.style.color).toContain('--fo-success');
    });

    it('shows a down arrow in error colour for a bad fall', () => {
      const el = render({ deltaPct: -0.27 });
      const delta = el.querySelector('.kpi__delta') as HTMLElement;

      expect(delta.querySelector('mat-icon')?.textContent?.trim()).toBe('arrow_downward');
      expect(delta.style.color).toContain('--fo-error');
    });

    it('treats a rise as bad when higher is worse', () => {
      const el = render({ deltaPct: 0.3, higherIsBetter: false });
      const delta = el.querySelector('.kpi__delta') as HTMLElement;

      // The arrow still points up — the direction is a fact; only the
      // judgement of it changes.
      expect(delta.querySelector('mat-icon')?.textContent?.trim()).toBe('arrow_upward');
      expect(delta.style.color).toContain('--fo-error');
    });
  });

  // `.fo-figure` is the shared figure treatment and carries
  // `font-variant-numeric: tabular-nums` itself, which is what makes a column
  // of KPIs align. Asserting the class rather than the computed property
  // because the global stylesheet is not loaded under jsdom — so this holds
  // the card to using the shared treatment, which is the actual requirement.
  it('uses the shared figure treatment, so columns of KPIs align', () => {
    const value = render().querySelector('.kpi__value');

    expect(value?.classList).toContain('fo-figure');
  });

  it('renders the unit apart from the number, so the digits read first', () => {
    const value = render({ prefix: 'RM ', value: 1234 }).querySelector('.kpi__value');
    const unit = value?.querySelector('.fo-figure__unit');

    expect(unit?.textContent?.trim()).toBe('RM');
    // The number itself must not be inside the unit span, or it would be
    // shrunk and muted along with it.
    expect(value?.textContent).toContain('1,234');
  });
});
