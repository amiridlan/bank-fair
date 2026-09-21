import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Fair applications · BankFair',
    loadComponent: () => import('./pages/employer-fairs-page.component'),
  },
];

export default routes;
