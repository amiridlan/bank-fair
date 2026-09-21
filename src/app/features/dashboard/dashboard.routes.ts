import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · BankFair',
    loadComponent: () => import('./pages/dashboard-page.component'),
  },
];

export default routes;
