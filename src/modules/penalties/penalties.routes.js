const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./penalties.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

// Two routers : nested (under /tournaments/:tournamentId) and standalone.
const tournamentRouter = express.Router({ mergeParams: true });
const standaloneRouter = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const createRules = [
  body('player_id').isInt({ min: 1 }),
  body('type_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('points').optional().isFloat(),
  body('reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 255 }),
  body('applied_round_id').optional({ nullable: true }).isInt({ min: 1 }),
];

const updateRules = [
  body('player_id').isInt({ min: 1 }),
  body('type_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('points').isFloat(),
  body('reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 255 }),
  body('applied_round_id').optional({ nullable: true }).isInt({ min: 1 }),
];

// /tournaments/:tournamentId/penalties
tournamentRouter.get('/', asyncHandler(controller.listByTournament));
tournamentRouter.post(
  '/',
  createRules,
  validate,
  asyncHandler(controller.create)
);

// /penalties/:id
standaloneRouter.get('/:id', idParam, validate, asyncHandler(controller.getById));
standaloneRouter.put(
  '/:id',
  [...idParam, ...updateRules],
  validate,
  asyncHandler(controller.update)
);
standaloneRouter.delete(
  '/:id',
  idParam,
  validate,
  asyncHandler(controller.remove)
);

module.exports = { tournamentRouter, standaloneRouter };
