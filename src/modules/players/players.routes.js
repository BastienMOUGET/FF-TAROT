const express = require('express');
const router = express.Router();

const controller = require('./players.controller');

router.get('/', controller.getPlayers);
router.post('/', controller.createPlayer);

module.exports = router;