import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Talent pool · BankFair',
    loadComponent: () => import('./pages/talent-pool-page.component'),
    children: [
      {
        // The profile drawer renders into the page's outlet, so its URL is
        // deep-linkable and survives a refresh.
        path: ':candidateId',
        loadComponent: () => import('./pages/candidate-drawer.component'),
      },
    ],
  },
];

export default routes;
