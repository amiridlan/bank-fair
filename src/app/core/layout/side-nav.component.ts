import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import type { Role } from '../models';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
}

const STAFF_NAV: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/staff/dashboard' },
  { label: 'Fairs', icon: 'event', route: '/staff/fairs' },
  { label: 'Employers', icon: 'apartment', route: '/staff/employers' },
  { label: 'Registrations', icon: 'how_to_reg', route: '/staff/registrations' },
];

const EMPLOYER_NAV: readonly NavItem[] = [
  { label: 'Talent pool', icon: 'groups', route: '/hiring/talent-pool' },
  { label: 'Shortlist', icon: 'bookmark', route: '/hiring/shortlist' },
  { label: 'Interviews', icon: 'calendar_month', route: '/hiring/interviews' },
  { label: 'Fairs', icon: 'event', route: '/hiring/fairs' },
];

/**
 * A record over `Role`, not a ternary.
 *
 * With two roles `isStaff() ? a : b` was fine. With three it silently sends
 * the odd one out to the wrong menu, whereas an exhaustive record makes the
 * compiler name the role that was forgotten.
 */
const JOB_SEEKER_NAV: readonly NavItem[] = [
  { label: 'Career fairs', icon: 'event', route: '/me/fairs' },
  { label: 'My profile', icon: 'person', route: '/me/profile' },
];

const NAV_BY_ROLE: Readonly<Record<Role, readonly NavItem[]>> = {
  staff: STAFF_NAV,
  employer: EMPLOYER_NAV,
  job_seeker: JOB_SEEKER_NAV,
};

/**
 * Settings sits at the bottom, away from the working pages.
 *
 * Its route differs per role only because each role's section is behind its
 * own `roleGuard`; the page itself is one component. Keyed by role for the
 * same reason as the menus above — the compiler names a role that was
 * forgotten rather than sending it somewhere its guard will refuse.
 */
const SETTINGS_BY_ROLE: Readonly<Record<Role, NavItem>> = {
  staff: { label: 'Settings', icon: 'settings', route: '/staff/settings' },
  employer: { label: 'Settings', icon: 'settings', route: '/hiring/settings' },
  job_seeker: { label: 'Settings', icon: 'settings', route: '/me/settings' },
};

/**
 * Role-aware navigation. Only the active role's routes are listed — another
 * role's URLs are blocked by `roleGuard` anyway, so showing them would just
 * offer dead ends.
 *
 * In `rail` mode the labels are hidden but each link keeps an `aria-label`, so
 * the collapsed nav stays usable with a screen reader.
 */
@Component({
  selector: 'app-side-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="nav" [class.nav--rail]="rail()" aria-label="Main">
      <ul class="nav__list">
        @for (item of items(); track item.route) {
          <li>
            <ng-container [ngTemplateOutlet]="link" [ngTemplateOutletContext]="{ $implicit: item }" />
          </li>
        }
      </ul>

      <!-- A second list rather than a last item: it is pushed to the bottom,
           and a separate <ul> keeps that a grouping rather than a gap in the
           middle of one list for anyone reading it as a list. -->
      <ul class="nav__list nav__list--end">
        <li>
          <ng-container
            [ngTemplateOutlet]="link"
            [ngTemplateOutletContext]="{ $implicit: settings() }"
          />
        </li>
      </ul>
    </nav>

    <ng-template #link let-item>
      <a
        class="nav__link"
        [routerLink]="item.route"
        routerLinkActive="nav__link--active"
        [routerLinkActiveOptions]="{ exact: false }"
        [attr.aria-label]="rail() ? item.label : null"
        [title]="rail() ? item.label : ''"
        (click)="navigated.emit()"
      >
        <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
        @if (!rail()) {
          <span class="nav__label">{{ item.label }}</span>
        }
      </a>
    </ng-template>
  `,
  styles: `
    .nav {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--fo-space-3) var(--fo-space-2);
      background: var(--fo-surface-raised);
      border-right: 1px solid var(--fo-border);
      box-sizing: border-box;
    }

    .nav__list {
      display: flex;
      flex-direction: column;
      gap: var(--fo-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .nav__link {
      display: flex;
      align-items: center;
      gap: var(--fo-space-3);
      /* 44px minimum touch target. */
      min-height: 44px;
      padding: 0 var(--fo-space-3);
      border-radius: var(--fo-radius-sm);
      color: var(--fo-text);
      text-decoration: none;
      font-weight: 500;
      transition: background-color var(--fo-motion-fast) var(--fo-motion-easing);
    }

    .nav__link:hover {
      background: var(--fo-surface);
    }

    .nav__link--active {
      background: var(--fo-primary-subtle);
      color: var(--fo-ink);
    }

    .nav__link--active mat-icon {
      color: var(--fo-primary);
    }

    .nav--rail .nav__link {
      justify-content: center;
      padding: 0;
    }

    /* Pushed to the bottom, with a rule above it so it reads as a separate
       group rather than the tail of the main menu. */
    .nav__list--end {
      margin-top: auto;
      padding-top: var(--fo-space-3);
      border-top: 1px solid var(--fo-border);
    }
  `,
})
export class SideNavComponent {
  private readonly auth = inject(AuthStore);

  /** Collapsed icon-only nav, used between 768px and 1279px. */
  readonly rail = input<boolean>(false);

  /** Lets the shell close the mobile drawer after a link is followed. */
  readonly navigated = output<void>();

  protected readonly items = computed<readonly NavItem[]>(() => NAV_BY_ROLE[this.auth.role()]);
  protected readonly settings = computed<NavItem>(() => SETTINGS_BY_ROLE[this.auth.role()]);
}
