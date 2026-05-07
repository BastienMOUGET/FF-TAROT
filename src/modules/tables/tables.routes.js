const express = require('express');

const router = express.Router();

const controller = require('./tables.controller');

router.post('/',
  controller.create
);

router.get('/:roundId',
  controller.list
);

module.exports = router;