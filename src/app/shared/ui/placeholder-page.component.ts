import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from './empty-state.component';
import { PageHeaderComponent } from './page-header.component';

/**
 * Stand-in for a page whose feature has not been built yet.
 *
 * It exists so every route in the information architecture resolves from
 * Phase 1b onwards — the shell, guards, lazy loading and nav can all be
 * exercised before any feature code lands. Each phase replaces its own.
 */
@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, PageHeaderComponent],
  template: `
    <app-page-header [title]="title()" [description]="description()" />
    <app-empty-state
      [icon]="icon()"
      heading="Not built yet"
      [message]="'This screen arrives in ' + phase() + '.'"
    />
  `,
})
export class PlaceholderPageComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly icon = input<string>('construction');
  readonly phase = input.required<string>();
}
