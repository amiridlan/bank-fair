import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder shaped like the content it replaces — rows for a table,
 * cards for a grid — rather than a lone spinner (docs/02).
 *
 * `aria-busy` plus a visually hidden label means screen readers hear "Loading"
 * once, not one announcement per shimmer block.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-busy': 'true',
    role: 'status',
  },
  template: `
    <span class="fo-sr-only">{{ label() }}</span>
    @for (block of blocks(); track block) {
      <span class="skeleton__block" [style.height.px]="height()" aria-hidden="true"></span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-2);
      width: 100%;
    }

    .skeleton__block {
      display: block;
      width: 100%;
      border-radius: var(--fo-radius-sm);
      background: linear-gradient(
        90deg,
        var(--fo-border) 25%,
        var(--fo-muted-subtle) 37%,
        var(--fo-border) 63%
      );
      background-size: 400% 100%;
      animation: skeleton-shimmer 1.4s ease infinite;
    }

    @keyframes skeleton-shimmer {
      0% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0 50%;
      }
    }

    /* A shimmering block is exactly the kind of motion this setting is for. */
    @media (prefers-reduced-motion: reduce) {
      .skeleton__block {
        animation: none;
        background: var(--fo-border);
      }
    }
  `,
})
export class SkeletonComponent {
  readonly count = input<number>(3);
  readonly height = input<number>(48);
  readonly label = input<string>('Loading');

  /** `@for` needs something iterable; the index doubles as the track key. */
  protected readonly blocks = computed(() =>
    Array.from({ length: Math.max(1, this.count()) }, (_unused, index) => index),
  );
}
