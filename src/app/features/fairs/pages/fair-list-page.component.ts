import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-fair-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Fairs"
      description="Every fair, filterable by status and city."
      icon="event"
      phase="Phase 3"
    />
  `,
})
export default class FairListPageComponent {}
