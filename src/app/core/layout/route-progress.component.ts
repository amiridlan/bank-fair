import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * A bar across the top while the router is working.
 *
 * Every feature is lazy loaded, so following a nav link fetches a chunk before
 * the target page can render its own skeleton. Until now that gap showed
 * nothing at all: on a slow connection the app looked like it had ignored the
 * click. This fills exactly that gap and stops at the point where the page's
 * skeleton takes over.
 *
 * `toSignal` rather than a subscription because the app is zoneless — an
 * ordinary subscription updates a field that nothing tells Angular to re-read.
 *
 * Written in CSS rather than with `mat-progress-bar`: Material's bar costs
 * 11.95 kB in the initial bundle and this app has under 11 kB of room before
 * its 650 kB budget warns. Measured, not assumed.
 */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (navigating()) {
      <!-- Indeterminate: the router cannot say how far through it is, so
           there is no aria-valuenow to give. -->
      <div class="bar" role="progressbar" aria-label="Loading page">
        <span class="bar__lead"></span>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 5;
      /* Reserves nothing when idle: the bar overlays the content edge rather
         than pushing the page down and reflowing it on every navigation. */
      height: 0;
      overflow: visible;
    }

    .bar {
      position: relative;
      height: 3px;
      overflow: hidden;
      background: var(--fo-primary-subtle);
    }

    .bar__lead {
      position: absolute;
      inset-block: 0;
      inline-size: 40%;
      background: var(--fo-primary);
      animation: route-progress 1.1s var(--fo-motion-easing) infinite;
    }

    @keyframes route-progress {
      0% {
        inset-inline-start: -40%;
      }
      100% {
        inset-inline-start: 100%;
      }
    }

    /* A bar sliding across the screen is exactly the motion this setting is
       for. Reduced to a static tint that still says "working". */
    @media (prefers-reduced-motion: reduce) {
      .bar__lead {
        animation: none;
        inline-size: 100%;
        inset-inline-start: 0;
        opacity: 0.5;
      }
    }
  `,
})
export class RouteProgressComponent {
  private readonly router = inject(Router);

  /**
   * True between a navigation starting and it ending, being cancelled, or
   * failing. All three closing events matter: a guard redirect cancels rather
   * than ends, and leaving the bar running would strand it on screen forever.
   */
  readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );
}
