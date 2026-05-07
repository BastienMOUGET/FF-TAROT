const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const errorHandler = require('./middleware/errorHandler');
const { authenticate, requireAuth, requireRole } = require('./middleware/auth');

// Référentiel
const liguesRoutes = require('./modules/ligues/ligues.routes');
const comitesRoutes = require('./modules/comites/comites.routes');
const clubsRoutes = require('./modules/clubs/clubs.routes');
const playersRoutes = require('./modules/players/players.routes');

// Tournois & inscriptions
const tournamentsRoutes = require('./modules/tournaments/tournaments.routes');
const subTournamentsRoutes = require('./modules/sub-tournaments/sub-tournaments.routes');
const teamsRoutes = require('./modules/teams/teams.routes');

// Rounds & mouvements
const roundsRoutes = require('./modules/rounds/rounds.routes');
const movementPatternsRoutes = require('./modules/movement-patterns/movement-patterns.routes');

// Saisie des scores (table_results + hands)
const scoringRoutes = require('./modules/scoring/scoring.routes');

// Classement (live)
const rankingRoutes = require('./modules/ranking/ranking.routes');

// Pénalités
const penaltyTypesRoutes = require('./modules/penalty-types/penalty-types.routes');
const penaltiesRoutes = require('./modules/penalties/penalties.routes');

// PCN / PP : grilles + export
const ppGridsRoutes = require('./modules/pp-grids/pp-grids.routes');

// Feuille de route (agrégation imprimable)
const routeSheetRoutes = require('./modules/route-sheet/route-sheet.routes');

// Cartes & jeux de donnes pré-tirées
const cardsRoutes = require('./modules/cards/cards.routes');
const donneSetsRoutes = require('./modules/donne-sets/donne-sets.routes');

// Auth
const authRoutes = require('./modules/auth/auth.routes');

const app = express();

app.use(cors());
app.use(express.json());

// JSON parse error → 400
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  next(err);
});

/*
|--------------------------------------------------------------------------
| API : tout le métier sous /api/*
|--------------------------------------------------------------------------
*/

const apiRouter = express.Router();

// Parse Bearer token (no-op si absent). req.user set si token valide.
apiRouter.use(authenticate);

// Endpoint de santé / info
apiRouter.get('/', (req, res) => {
  res.json({ app: 'FFT TAROT API', version: '1.0.0' });
});

// Auth (login public, /me et /users sous le router)
apiRouter.use('/auth', authRoutes.router);

// Guard : mutations -> auth required. GET / HEAD / OPTIONS publics.
apiRouter.use((req, res, next) => {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  return requireAuth(req, res, next);
});

// Référentiel : POST/PUT/DELETE = admin
const adminOnly = (req, res, next) => {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  return requireRole('admin')(req, res, next);
};

apiRouter.use('/ligues', adminOnly, liguesRoutes);
apiRouter.use('/comites', adminOnly, comitesRoutes);
apiRouter.use('/clubs', adminOnly, clubsRoutes);
apiRouter.use('/players', adminOnly, playersRoutes);
apiRouter.use('/penalty-types', adminOnly, penaltyTypesRoutes);
apiRouter.use('/users', authRoutes.usersRouter);

// Tournois & sub-tournois
apiRouter.use(
  '/tournaments/:tournamentId/sub-tournaments',
  subTournamentsRoutes
);
apiRouter.use('/tournaments', tournamentsRoutes);
apiRouter.use('/sub-tournaments', subTournamentsRoutes);

// Équipes
apiRouter.use('/sub-tournaments/:subTournamentId/teams', teamsRoutes);
apiRouter.use('/teams', teamsRoutes);

// Rounds
apiRouter.use('/sub-tournaments/:subTournamentId/rounds', roundsRoutes);
apiRouter.use('/rounds', roundsRoutes);

// Patrons de mouvement
apiRouter.use('/movement-patterns', adminOnly, movementPatternsRoutes);

// Saisie scores
apiRouter.use('/rounds/:roundId', scoringRoutes.tableRouter);
apiRouter.use('/hands', scoringRoutes.handRouter);

// Classement
apiRouter.use('/sub-tournaments/:subTournamentId/ranking', rankingRoutes);

// Pénalités
apiRouter.use(
  '/tournaments/:tournamentId/penalties',
  penaltiesRoutes.tournamentRouter
);
apiRouter.use('/penalties', penaltiesRoutes.standaloneRouter);

// Grille PP
apiRouter.use('/sub-tournaments/:subTournamentId/pp-grid', ppGridsRoutes);

// Feuille de route
apiRouter.use(
  '/sub-tournaments/:subTournamentId/route-sheet',
  routeSheetRoutes
);

// Cartes & donnes
apiRouter.use('/cards', cardsRoutes);
apiRouter.use('/donne-sets', donneSetsRoutes);

// 404 API
apiRouter.use((req, res) => {
  res.status(404).json({ error: 'Route API introuvable' });
});

// Mount the API
app.use('/api', apiRouter);

/*
|--------------------------------------------------------------------------
| FRONT STATIQUE : sert le bundle Angular si présent.
| Active uniquement si frontend/dist/frontend/browser/index.html existe
| (i.e. l'app a été build via `cd frontend && npm run build`).
|--------------------------------------------------------------------------
*/

const FRONT_DIST = path.join(
  __dirname,
  '..',
  'frontend',
  'dist',
  'frontend',
  'browser'
);
const FRONT_INDEX = path.join(FRONT_DIST, 'index.html');

if (fs.existsSync(FRONT_INDEX)) {
  app.use(
    express.static(FRONT_DIST, {
      maxAge: '1h',
      index: false, // on gère index.html via le fallback
    })
  );

  // Fallback SPA : toute requête GET non-API renvoie index.html.
  // C'est ce qui permet à /tournaments/42 de marcher après refresh.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return next();
    }
    res.sendFile(FRONT_INDEX);
  });
} else {
  // Pas de front buildé : juste un message d'aide
  app.get('/', (req, res) => {
    res.json({
      app: 'FFT TAROT API',
      version: '1.0.0',
      note: 'Front non buildé. Lancer `cd frontend && npm run build` pour servir l\'UI sur ce port.',
      api: '/api',
    });
  });
}

/*
|--------------------------------------------------------------------------
| 404 fallback (pour les rares cas où le static a laissé passer)
|--------------------------------------------------------------------------
*/
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Error handler (en dernier)
app.use(errorHandler);

module.exports = app;
