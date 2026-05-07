const express = require('express');
const { param } = require('express-validator');

const controller = require('./ranking.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

const idParam = [
  param('subTournamentId').isInt({ min: 1 }).withMessage('id invalide'),
];

router.get('/', idParam, validate, asyncHandler(controller.get));

router.post(
  '/recompute',
  idParam,
  validate,
  asyncHandler(controller.recompute)
);

module.exports = router;
