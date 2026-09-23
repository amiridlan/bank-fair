import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Talent pool · BankFair',
    loadComponent: () => import('./pages/talent-pool-page.component'),
    children: [
      {
        // The profile is a modal, but still a child route: the URL carries the
        // candidate id, so it is deep-linkable and survives a refresh. The
        // routed component renders nothing — it opens the dialog.
        path: ':candidateId',
        loadComponent: () => import('./pages/candidate-route.component'),
      },
    ],
  },
];

export default routes;
