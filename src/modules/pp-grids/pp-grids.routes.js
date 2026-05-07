const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./pp-grids.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

const idParam = [
  param('subTournamentId').isInt({ min: 1 }).withMessage('id invalide'),
];

router.get('/', idParam, validate, asyncHandler(controller.get));

router.put(
  '/',
  [
    ...idParam,
    body('entries').isArray(),
    body('entries.*.place').isInt({ min: 1 }),
    body('entries.*.pp').isFloat(),
  ],
  validate,
  asyncHandler(controller.replace)
);

router.delete('/', idParam, validate, asyncHandler(controller.clear));

module.exports = router;
