import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Dashboard"
      description="Booth fill, registrations and pipeline value across every fair."
      icon="dashboard"
      phase="Phase 3"
    />
  `,
})
export default class DashboardPageComponent {}
