const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./rounds.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

router.get('/', asyncHandler(controller.listBySubTournament));

router.get('/:id', idParam, validate, asyncHandler(controller.getById));

router.post(
  '/',
  [
    body('sub_tournament_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('coef').optional().isFloat({ min: 0, max: 10 }),
  ],
  validate,
  asyncHandler(controller.create)
);

router.post(
  '/:id/generate',
  idParam,
  validate,
  asyncHandler(controller.generatePlacement)
);

router.delete('/:id', idParam, validate, asyncHandler(controller.remove));

module.exports = router;
