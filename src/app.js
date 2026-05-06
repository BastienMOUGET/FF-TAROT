const express = require('express');
const cors = require('cors');
const { ranking } = require('./modules/ranking/ranking.controller');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/ranking/:tournamentId', ranking);

module.exports = app;