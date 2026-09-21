import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-employer-board-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Employers"
      description="Sales pipeline from Lead through to Paid."
      icon="apartment"
      phase="Phase 4"
    />
  `,
})
export default class EmployerBoardPageComponent {}
