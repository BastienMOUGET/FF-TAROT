const express = require('express');
const { param } = require('express-validator');

const controller = require('./route-sheet.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  [param('subTournamentId').isInt({ min: 1 }).withMessage('id invalide')],
  validate,
  asyncHandler(controller.get)
);

module.exports = router;
