import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PlaceholderPageComponent } from '../../../shared/ui/placeholder-page.component';

@Component({
  selector: 'app-interviews-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Interviews"
      description="Book shortlisted candidates into 20-minute slots on fair day."
      icon="calendar_month"
      phase="Phase 5b"
    />
  `,
})
export default class InterviewsPageComponent {}
