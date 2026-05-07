const express = require('express');
const cors = require('cors');

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

// Parse Bearer token (no-op if absent). req.user set if valid token.
app.use(authenticate);

/*
|--------------------------------------------------------------------------
| ROUTES PUBLIQUES (sans auth)
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {
  res.json({
    app: 'FFT TAROT API',
    version: '1.0.0',
  });
});

app.use('/auth', authRoutes.router);

/*
|--------------------------------------------------------------------------
| GUARD : mutations (POST/PUT/PATCH/DELETE) requièrent auth.
| GET / HEAD / OPTIONS restent accessibles à tous (lecture publique).
|--------------------------------------------------------------------------
*/
app.use((req, res, next) => {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  return requireAuth(req, res, next);
});

/*
|--------------------------------------------------------------------------
| ROUTES MÉTIER
|--------------------------------------------------------------------------
*/

// Référentiel : POST/PUT/DELETE = admin uniquement (déjà auth via guard ci-dessus)
const adminOnly = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  return requireRole('admin')(req, res, next);
};

app.use('/ligues', adminOnly, liguesRoutes);
app.use('/comites', adminOnly, comitesRoutes);
app.use('/clubs', adminOnly, clubsRoutes);
app.use('/players', adminOnly, playersRoutes);
app.use('/penalty-types', adminOnly, penaltyTypesRoutes);
app.use('/users', authRoutes.usersRouter);

// Tournois & sub-tournois (nested + standalone)
app.use(
  '/tournaments/:tournamentId/sub-tournaments',
  subTournamentsRoutes
);
app.use('/tournaments', tournamentsRoutes);
app.use('/sub-tournaments', subTournamentsRoutes);

// Équipes (nested + standalone)
app.use('/sub-tournaments/:subTournamentId/teams', teamsRoutes);
app.use('/teams', teamsRoutes);

// Rounds (nested + standalone)
app.use('/sub-tournaments/:subTournamentId/rounds', roundsRoutes);
app.use('/rounds', roundsRoutes);

// Patrons de mouvement (modifiable par admin uniquement)
app.use('/movement-patterns', adminOnly, movementPatternsRoutes);

// Saisie scores : table-results et hands sur les rounds
app.use('/rounds/:roundId', scoringRoutes.tableRouter);
app.use('/hands', scoringRoutes.handRouter);

// Classement
app.use('/sub-tournaments/:subTournamentId/ranking', rankingRoutes);

// Pénalités
app.use(
  '/tournaments/:tournamentId/penalties',
  penaltiesRoutes.tournamentRouter
);
app.use('/penalties', penaltiesRoutes.standaloneRouter);

// Grille PP par sous-tournoi
app.use('/sub-tournaments/:subTournamentId/pp-grid', ppGridsRoutes);

// Feuille de route imprimable
app.use(
  '/sub-tournaments/:subTournamentId/route-sheet',
  routeSheetRoutes
);

// Cartes & jeux de donnes pré-tirées
app.use('/cards', cardsRoutes);
app.use('/donne-sets', donneSetsRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Error handler (en dernier)
app.use(errorHandler);

module.exports = app;
