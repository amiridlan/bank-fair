import { Routes } from '@angular/router';

import { roleGuard, roleHomeRedirectGuard } from './core/auth/role.guard';
import { ShellComponent } from './core/layout/shell.component';

/**
 * Information architecture from docs/02.
 *
 * Every feature is lazy loaded, so a hiring manager never downloads the staff
 * bundles and vice versa. `canMatch` (rather than `canActivate`) means a
 * blocked branch does not match at all, which also skips fetching its chunk.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [roleHomeRedirectGuard],
    // Never reached: the guard always returns a redirect UrlTree. The router
    // still requires something to match against.
    children: [],
  },
  {
    path: 'staff',
    component: ShellComponent,
    canMatch: [roleGuard('staff')],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes'),
      },
      {
        path: 'fairs',
        loadChildren: () => import('./features/fairs/fairs.routes'),
      },
      {
        path: 'employers',
        loadChildren: () => import('./features/employers/employers.routes'),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  {
    path: 'hiring',
    component: ShellComponent,
    canMatch: [roleGuard('hiring_manager')],
    children: [
      {
        path: 'talent-pool',
        loadChildren: () => import('./features/talent-pool/talent-pool.routes'),
      },
      {
        path: 'shortlist',
        loadChildren: () => import('./features/shortlist/shortlist.routes'),
      },
      {
        path: 'interviews',
        loadChildren: () => import('./features/interviews/interviews.routes'),
      },
      { path: '', redirectTo: 'talent-pool', pathMatch: 'full' },
    ],
  },
  {
    path: '**',
    title: 'Page not found · BankFair',
    loadComponent: () => import('./core/layout/not-found.component'),
  },
];
