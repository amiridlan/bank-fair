import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Fairs · BankFair',
    loadComponent: () => import('./pages/fair-list-page.component'),
  },
  {
    // The detail page is a shell: it owns the fair header and the tab bar,
    // and each tab is a child route. That keeps every tab deep-linkable and
    // shareable, which is how the rest of the app treats view state.
    path: ':fairId',
    loadComponent: () => import('./pages/fair-detail-page.component'),
    children: [
      {
        path: '',
        title: 'Fair · BankFair',
        loadComponent: () => import('./pages/fair-overview-tab.component'),
      },
      {
        path: 'floor-plan',
        title: 'Floor plan · BankFair',
        loadComponent: () => import('./pages/floor-plan-page.component'),
      },
      {
        path: 'employers',
        title: 'Fair employers · BankFair',
        loadComponent: () => import('./pages/fair-employers-tab.component'),
      },
    ],
  },
];

export default routes;
