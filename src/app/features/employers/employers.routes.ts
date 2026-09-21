import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Employers · BankFair',
    loadComponent: () => import('./pages/employer-board-page.component'),
  },
];

export default routes;
