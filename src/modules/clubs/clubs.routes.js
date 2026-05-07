const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('./clubs.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('code').isString().trim().notEmpty().isLength({ max: 15 }),
  body('name').isString().trim().notEmpty().isLength({ max: 150 }),
  body('comite_id').optional({ nullable: true }).isInt({ min: 1 }),
];

router.get(
  '/',
  [query('comite_id').optional().isInt({ min: 1 })],
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
