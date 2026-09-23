import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'fairs',
    title: 'Career fairs · BankFair',
    loadComponent: () => import('./pages/seeker-fairs-page.component'),
  },
  {
    // A shell owning the header and the tab bar, with each tab a child route,
    // so every tab is deep-linkable — the same shape as the staff fair detail.
    path: 'fairs/:fairId',
    loadComponent: () => import('./pages/seeker-fair-detail-page.component'),
    children: [
      {
        path: 'employers',
        title: 'Employers at this fair · BankFair',
        loadComponent: () => import('./pages/seeker-fair-exhibitors-tab.component'),
      },
      {
        path: 'details',
        title: 'Fair details · BankFair',
        loadComponent: () => import('./pages/seeker-fair-details-tab.component'),
      },
      // Employers is the landing tab for now. J3 puts the Jobs tab here
      // instead, which replaces this one line and breaks no URL that works
      // today (docs/11 J-D4).
      { path: '', redirectTo: 'employers', pathMatch: 'full' },
    ],
  },
  {
    path: 'profile',
    title: 'My profile · BankFair',
    loadComponent: () => import('./pages/seeker-profile-page.component'),
  },
  {
    // Its own chunk, shared with the other two roles' settings routes.
    path: 'settings',
    loadChildren: () => import('../settings/settings.routes'),
  },
  { path: '', redirectTo: 'fairs', pathMatch: 'full' },
];

export default routes;
