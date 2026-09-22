import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Settings · BankFair',
    loadComponent: () => import('./pages/settings-page.component'),
  },
];

export default routes;
