const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('./tournaments.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const VALID_STATUSES = ['draft', 'open', 'running', 'closed'];

const bodyRules = [
  body('code').isString().trim().notEmpty().isLength({ max: 20 }),
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
  body('date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('type').optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 20 }),
  body('status').optional({ nullable: true, checkFalsy: true })
    .isIn(VALID_STATUSES),
  body('current_round').optional({ nullable: true }).isInt({ min: 0 }),
  body('coef_default').optional({ nullable: true })
    .isFloat({ min: 0, max: 10 }),
  body('club_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('comite_id').optional({ nullable: true }).isInt({ min: 1 }),
];

router.get(
  '/',
  [
    query('status').optional().isIn(VALID_STATUSES),
    query('type').optional().isString().isLength({ max: 20 }),
    query('club_id').optional().isInt({ min: 1 }),
    query('comite_id').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(controller.list)
);

router.get('/:id', idParam, validate, asyncHandler(controller.getById));

router.post('/', bodyRules, validate, asyncHandler(controller.create));

router.put(
  '/:id',
  [...idParam, ...bodyRules],
  validate,
  asyncHandler(controller.update)
);

router.delete('/:id', idParam, validate, asyncHandler(controller.remove));

module.exports = router;
