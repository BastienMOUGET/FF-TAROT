import { Routes } from '@angular/router';

import { authGuard, adminGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tournaments' },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./pages/tournaments-list/tournaments-list.page').then(
            (m) => m.TournamentsListPage
          ),
      },
      {
        path: 'tournaments/:id',
        loadComponent: () =>
          import('./pages/tournament-detail/tournament-detail.page').then(
            (m) => m.TournamentDetailPage
          ),
      },
      {
        path: 'sub-tournaments/:id/teams',
        loadComponent: () =>
          import('./pages/teams/teams.page').then((m) => m.TeamsPage),
      },
      {
        path: 'rounds/:id',
        loadComponent: () =>
          import('./pages/round-detail/round-detail.page').then(
            (m) => m.RoundDetailPage
          ),
      },
      {
        path: 'rounds/:id/tables/:tableNumber',
        loadComponent: () =>
          import('./pages/scoring/scoring.page').then(
            (m) => m.ScoringPage
          ),
      },
      {
        path: 'sub-tournaments/:id/ranking',
        loadComponent: () =>
          import('./pages/ranking/ranking.page').then(
            (m) => m.RankingPage
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/admin.page').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
