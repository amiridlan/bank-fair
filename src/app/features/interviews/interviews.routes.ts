import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Interviews · BankFair',
    loadComponent: () => import('./pages/interviews-page.component'),
  },
];

export default routes;
