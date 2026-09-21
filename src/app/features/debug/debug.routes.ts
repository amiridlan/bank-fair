import { Routes } from '@angular/router';

// TODO(Phase 6): delete this feature entirely.
const routes: Routes = [
  {
    path: '',
    title: 'Debug · BankFair',
    loadComponent: () => import('./pages/debug-page.component'),
  },
];

export default routes;
