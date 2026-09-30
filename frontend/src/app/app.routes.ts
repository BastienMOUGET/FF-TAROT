import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

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
        path: 'sub-tournaments/:id',
        loadComponent: () =>
          import('./pages/sub-tournament-detail/sub-tournament-detail.page').then(
            (m) => m.SubTournamentDetailPage
          ),
      },
      {
        path: 'sub-tournaments/:id/score-sheets',
        loadComponent: () =>
          import('./pages/score-sheets/score-sheets.page').then(
            (m) => m.ScoreSheetsPage
          ),
      },
      {
        path: 'rounds/:id/ranking',
        loadComponent: () =>
          import('./pages/round-ranking/round-ranking.page').then(
            (m) => m.RoundRankingPage
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
        path: 'sub-tournaments/:id/pp-grid',
        loadComponent: () =>
          import('./pages/pp-grid/pp-grid.page').then((m) => m.PpGridPage),
      },
      {
        path: 'sub-tournaments/:id/route-sheet',
        loadComponent: () =>
          import('./pages/route-sheet/route-sheet.page').then(
            (m) => m.RouteSheetPage
          ),
      },
      {
        path: 'aide',
        loadComponent: () =>
          import('./pages/help/help.page').then((m) => m.HelpPage),
      },
      {
        // Accessible à tout compte connecté, mais en lecture seule hors
        // administrateur : masquer l'écran entier privait les utilisateurs de
        // la simple consultation des joueurs, des clubs et des paramètres, et
        // rendait invisible le grisé promis sur Sauvegarder/Restaurer
        // (retour terrain n°17). Le serveur, lui, refuse toujours les
        // écritures à un non-admin — l'écran ne fait que le dire avant le clic.
        path: 'admin',
        loadComponent: () =>
          import('./pages/admin/admin.page').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
