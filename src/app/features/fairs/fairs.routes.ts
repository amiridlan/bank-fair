import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Fairs · BankFair',
    loadComponent: () => import('./pages/fair-list-page.component'),
  },
  {
    path: ':fairId/floor-plan',
    title: 'Floor plan · BankFair',
    loadComponent: () => import('./pages/floor-plan-page.component'),
  },
  {
    path: ':fairId',
    title: 'Fair · BankFair',
    loadComponent: () => import('./pages/fair-detail-page.component'),
  },
];

export default routes;
