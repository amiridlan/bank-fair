import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Standard page top: H1 on the left, primary action on the right, optional
 * filters row beneath (docs/03 "Page header pattern").
 *
 * Project actions into `[slot=actions]` and filters into `[slot=filters]`.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="header__row">
        <div class="header__titles">
          <h1>{{ title() }}</h1>
          @if (description(); as text) {
            <p class="header__description">{{ text }}</p>
          }
        </div>
        <div class="header__actions">
          <ng-content select="[slot=actions]" />
        </div>
      </div>
      <ng-content select="[slot=filters]" />
    </header>
  `,
  styles: `
    .header {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-4);
      margin-bottom: var(--fo-space-5);
    }

    .header__row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--fo-space-4);
    }

    .header__titles {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-1);
    }

    .header__description {
      margin: 0;
      color: var(--fo-text-muted);
      font-size: var(--fo-body-size);
      line-height: var(--fo-body-line);
    }

    .header__actions {
      display: flex;
      align-items: center;
      gap: var(--fo-space-2);
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
