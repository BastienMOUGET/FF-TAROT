const express = require('express');
const router = express.Router();

const controller = require('./rounds.controller');

router.post('/', controller.create);

router.get('/:tournamentId',
  controller.list
);

module.exports = router;