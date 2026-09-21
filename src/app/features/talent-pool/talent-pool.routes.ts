import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Talent pool · BankFair',
    loadComponent: () => import('./pages/talent-pool-page.component'),
  },
];

export default routes;
