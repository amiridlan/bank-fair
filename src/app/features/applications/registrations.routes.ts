import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Registrations · BankFair',
    loadComponent: () => import('./pages/registrations-page.component'),
    children: [
      {
        // The detail is a modal, but still a child route: the URL carries the
        // application id, so it is deep-linkable and survives a refresh. The
        // routed component renders nothing — it opens the dialog.
        path: ':applicationId',
        loadComponent: () => import('./pages/registration-route.component'),
      },
    ],
  },
];

export default routes;
