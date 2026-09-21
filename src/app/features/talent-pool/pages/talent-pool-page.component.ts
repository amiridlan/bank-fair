import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-talent-pool-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Talent pool"
      description="Filter candidates and add them to your shortlist."
      icon="groups"
      phase="Phase 5a"
    />
  `,
})
export default class TalentPoolPageComponent {}
