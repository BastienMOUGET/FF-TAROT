const express = require('express');
const cors = require('cors');

const playersRoutes = require('./modules/players/players.routes');
const tournamentsRoutes = require('./modules/tournaments/tournaments.routes');
const roundsRoutes = require('./modules/rounds/rounds.routes');
const scoresRoutes = require('./modules/scores/scores.routes');
const rankingRoutes = require('./modules/ranking/ranking.routes');
const tablesRoutes = require('./modules/tables/tables.routes');
const tableScoreRoutes = require('./modules/table-score/table-score.routes');

const app = express();

app.use(cors());

app.use(express.json());

app.use((err, req, res, next) => {

  if (err instanceof SyntaxError &&
      err.status === 400 &&
      'body' in err) {

    return res.status(400).json({
      error: 'JSON invalide'
    });

  }

  next();

});

/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

app.use('/players', playersRoutes);

app.use('/tournaments', tournamentsRoutes);

app.use('/rounds', roundsRoutes);

app.use('/scores', scoresRoutes);

app.use('/ranking', rankingRoutes);

app.use('/tables', tablesRoutes);

app.use('/table-score', tableScoreRoutes);

/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {

  res.json({
    app: 'FFT TAROT API',
    version: '1.0.0'
  });

});

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {

  res.status(404).json({
    error: 'Route introuvable'
  });

});

module.exports = app;