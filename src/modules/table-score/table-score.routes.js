const express = require('express');

const router = express.Router();

const controller = require('./table-score.controller');

router.post('/',
  controller.create
);

router.delete('/:tableId',
  controller.remove
);

module.exports = router;