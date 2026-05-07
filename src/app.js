const express = require('express');
const cors = require('cors');

const errorHandler = require('./middleware/errorHandler');

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
| ROUTES
|--------------------------------------------------------------------------
*/

// Référentiel
app.use('/ligues', liguesRoutes);
app.use('/comites', comitesRoutes);
app.use('/clubs', clubsRoutes);
app.use('/players', playersRoutes);

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

// Patrons de mouvement
app.use('/movement-patterns', movementPatternsRoutes);

// Saisie scores : table-results et hands sur les rounds
app.use('/rounds/:roundId', scoringRoutes.tableRouter);
app.use('/hands', scoringRoutes.handRouter);

// Classement
app.use('/sub-tournaments/:subTournamentId/ranking', rankingRoutes);

// Pénalités
app.use('/penalty-types', penaltyTypesRoutes);
app.use(
  '/tournaments/:tournamentId/penalties',
  penaltiesRoutes.tournamentRouter
);
app.use('/penalties', penaltiesRoutes.standaloneRouter);

app.get('/', (req, res) => {
  res.json({
    app: 'FFT TAROT API',
    version: '1.0.0',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Error handler (en dernier)
app.use(errorHandler);

module.exports = app;
