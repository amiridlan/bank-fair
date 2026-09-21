import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-fair-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [title]="'Fair ' + fairId()"
      description="Overview, floor plan and employers for this fair."
      icon="event_note"
      phase="Phase 3"
    />
  `,
})
export default class FairDetailPageComponent {
  /**
   * Bound straight from the `:fairId` route parameter by
   * `withComponentInputBinding()` — no ActivatedRoute subscription needed.
   */
  readonly fairId = input.required<string>();
}
