import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Shortlist · BankFair',
    loadComponent: () => import('./pages/shortlist-page.component'),
  },
];

export default routes;
