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
  { path: '', redirectTo: 'fairs', pathMatch: 'full' },
];

export default routes;
