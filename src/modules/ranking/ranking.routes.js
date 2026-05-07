const express = require('express');

const router = express.Router();

const controller = require('./ranking.controller');

router.get('/:tournamentId',
  controller.ranking
);

module.exports = router;