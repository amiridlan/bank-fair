import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { FairContextStore } from '../fairs/fair-context.store';
import { SideNavComponent } from './side-nav.component';
import { TopBarComponent } from './top-bar.component';

/** Breakpoints from docs/03: < 768 mobile, 768–1279 tablet, >= 1280 desktop. */
const MOBILE = '(max-width: 767px)';
const TABLET = '(min-width: 768px) and (max-width: 1279px)';

/**
 * App frame: fixed top bar, responsive side nav, routed content.
 *
 * The nav has three shapes — full 240px on desktop, a 72px icon rail on
 * tablet, and an overlay drawer on mobile. `BreakpointObserver` drives it, and
 * `toSignal` converts the stream so the template reads a signal rather than
 * managing a subscription.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSidenavModule, RouterOutlet, SideNavComponent, TopBarComponent],
  template: `
    <a class="fo-skip-link" href="#main-content">Skip to main content</a>

    <app-top-bar
      [showMenuButton]="isMobile()"
      [fairs]="fairContext.selectableFairs()"
      (menuToggled)="toggleDrawer()"
    />

    <mat-sidenav-container class="shell" [hasBackdrop]="isMobile()">
      <mat-sidenav
        class="shell__nav"
        [class.shell__nav--rail]="isTablet()"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="isMobile() ? drawerOpen() : true"
        (closedStart)="drawerOpen.set(false)"
      >
        <app-side-nav [rail]="isTablet()" (navigated)="closeDrawerOnMobile()" />
      </mat-sidenav>

      <!-- tabindex 0 so the scrolling region can be reached and scrolled with
           the keyboard. Without it a keyboard-only user cannot scroll a page
           whose content exceeds the viewport (WCAG 2.1.1). -->
      <mat-sidenav-content tabindex="0">
        <main id="main-content" class="shell__content" tabindex="-1">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .shell {
      flex: 1 1 auto;
      background: var(--fo-surface);
    }

    .shell__nav {
      width: var(--fo-sidenav-width);
      border-right: none;
    }

    .shell__nav--rail {
      width: var(--fo-sidenav-rail-width);
    }

    .shell__content {
      max-width: var(--fo-content-max-width);
      margin: 0 auto;
      padding: var(--fo-space-6);
      outline: none;
    }

    @media (max-width: 767px) {
      .shell__content {
        padding: var(--fo-space-4);
      }
    }
  `,
})
export class ShellComponent {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly auth = inject(AuthStore);

  protected readonly fairContext = inject(FairContextStore);

  protected readonly drawerOpen = signal(false);

  private readonly layout = toSignal(
    this.breakpoints.observe([MOBILE, TABLET]).pipe(
      map((result) => ({
        mobile: result.breakpoints[MOBILE] ?? false,
        tablet: result.breakpoints[TABLET] ?? false,
      })),
    ),
    { initialValue: { mobile: false, tablet: false } },
  );

  protected readonly isMobile = computed(() => this.layout().mobile);
  protected readonly isTablet = computed(() => this.layout().tablet);

  constructor() {
    // Only hiring managers get the picker, and only they need a fair scope.
    // Re-runs on a role switch, which clears the previously active fair.
    effect(() => {
      if (this.auth.isEmployer()) {
        void this.fairContext.ensureLoaded();
      }
    });
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  protected closeDrawerOnMobile(): void {
    if (this.isMobile()) {
      this.drawerOpen.set(false);
    }
  }
}
