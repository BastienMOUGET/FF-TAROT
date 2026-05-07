const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('./comites.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('code').isString().trim().notEmpty().isLength({ max: 10 }),
  body('name').isString().trim().notEmpty().isLength({ max: 100 }),
  body('ligue_id').optional({ nullable: true }).isInt({ min: 1 }),
];

router.get(
  '/',
  [query('ligue_id').optional().isInt({ min: 1 })],
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
