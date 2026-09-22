import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'fairs',
    title: 'Career fairs · BankFair',
    loadComponent: () => import('./pages/seeker-fairs-page.component'),
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
