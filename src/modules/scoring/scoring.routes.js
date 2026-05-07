const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./scoring.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

// Two routers: one for /rounds/:roundId/... endpoints (table-scoped),
// one for /hands/:id endpoints (hand-scoped).

const tableRouter = express.Router({ mergeParams: true });
const handRouter = express.Router();

const roundParam = param('roundId').isInt({ min: 1 });
const tableNumParam = param('tableNumber').isInt({ min: 1 });
const idParam = param('id').isInt({ min: 1 });

const codifRule = [
  body('codif_n').optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 5 }),
  body('codif_s').optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 5 }),
  body('codif_e').optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 5 }),
  body('codif_o').optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 5 }),
];

const handBodyRule = [
  body('hand_number').isInt({ min: 1 }),
  body('taker_seat')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['N', 'S', 'E', 'O']),
  body('score_n').optional().isInt(),
  body('score_s').optional().isInt(),
  body('score_e').optional().isInt(),
  body('score_o').optional().isInt(),
];

const handPatchRule = [
  body('hand_number').optional().isInt({ min: 1 }),
  body('taker_seat')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['N', 'S', 'E', 'O']),
  body('score_n').optional().isInt(),
  body('score_s').optional().isInt(),
  body('score_e').optional().isInt(),
  body('score_o').optional().isInt(),
];

/* /rounds/:roundId/... */

tableRouter.get(
  '/table-results',
  [roundParam],
  validate,
  asyncHandler(controller.listByRound)
);

tableRouter.get(
  '/tables/:tableNumber',
  [roundParam, tableNumParam],
  validate,
  asyncHandler(controller.getByRoundAndTable)
);

tableRouter.put(
  '/tables/:tableNumber/codifs',
  [roundParam, tableNumParam, ...codifRule],
  validate,
  asyncHandler(controller.setCodifs)
);

tableRouter.post(
  '/tables/:tableNumber/validate',
  [roundParam, tableNumParam],
  validate,
  asyncHandler(controller.validate)
);

tableRouter.post(
  '/tables/:tableNumber/unvalidate',
  [roundParam, tableNumParam],
  validate,
  asyncHandler(controller.unvalidate)
);

tableRouter.delete(
  '/tables/:tableNumber',
  [roundParam, tableNumParam],
  validate,
  asyncHandler(controller.removeByRoundAndTable)
);

tableRouter.post(
  '/tables/:tableNumber/hands',
  [roundParam, tableNumParam, ...handBodyRule],
  validate,
  asyncHandler(controller.addHand)
);

/* /hands/:id */

handRouter.put(
  '/:id',
  [idParam, ...handPatchRule],
  validate,
  asyncHandler(controller.updateHand)
);

handRouter.delete(
  '/:id',
  [idParam],
  validate,
  asyncHandler(controller.removeHand)
);

module.exports = { tableRouter, handRouter };
