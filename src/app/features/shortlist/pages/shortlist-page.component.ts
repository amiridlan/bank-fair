import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-shortlist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Shortlist"
      description="Candidates you have shortlisted for the active fair."
      icon="bookmark"
      phase="Phase 5a"
    />
  `,
})
export default class ShortlistPageComponent {}
