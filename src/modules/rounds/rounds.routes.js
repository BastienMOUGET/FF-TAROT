const express = require('express');
const router = express.Router();

const controller = require('./rounds.controller');

router.post('/', controller.create);

router.get('/:tournamentId',
  controller.list
);

router.post('/:id/generate',
  controller.generate
);

module.exports = router;