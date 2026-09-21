import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-floor-plan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      [title]="'Floor plan · ' + fairId()"
      description="Drag a confirmed employer onto a booth to assign it."
      icon="grid_view"
      phase="Phase 4"
    />
  `,
})
export default class FloorPlanPageComponent {
  readonly fairId = input.required<string>();
}
