import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Registrations · BankFair',
    loadComponent: () => import('./pages/registrations-page.component'),
  },
];

export default routes;
