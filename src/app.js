const express = require('express');
const cors = require('cors');

const errorHandler = require('./middleware/errorHandler');

// Référentiel
const liguesRoutes = require('./modules/ligues/ligues.routes');
const comitesRoutes = require('./modules/comites/comites.routes');
const clubsRoutes = require('./modules/clubs/clubs.routes');
const playersRoutes = require('./modules/players/players.routes');

// Tournois
const tournamentsRoutes = require('./modules/tournaments/tournaments.routes');

// NOTE: les modules ci-dessous référencent l'ancien schéma (game_tables,
// table_players, scores, byes) qui a été supprimé en Phase 1. Ils seront
// refondus en Phases 3-6 (sub_tournaments, teams, seats, table_results,
// hand_results, rankings).
// const roundsRoutes = require('./modules/rounds/rounds.routes');
// const scoresRoutes = require('./modules/scores/scores.routes');
// const rankingRoutes = require('./modules/ranking/ranking.routes');
// const tablesRoutes = require('./modules/tables/tables.routes');
// const tableScoreRoutes = require('./modules/table-score/table-score.routes');

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

app.use('/ligues', liguesRoutes);
app.use('/comites', comitesRoutes);
app.use('/clubs', clubsRoutes);
app.use('/players', playersRoutes);
app.use('/tournaments', tournamentsRoutes);

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
