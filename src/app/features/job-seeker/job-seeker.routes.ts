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
      {
        // The landing tab: someone opens a fair asking what work is here,
        // not which companies are (docs/11 J-D4).
        path: '',
        title: 'Roles at this fair · BankFair',
        loadComponent: () => import('./pages/seeker-fair-jobs-tab.component'),
      },
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
