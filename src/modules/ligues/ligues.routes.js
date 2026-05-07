const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./ligues.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('code').isString().trim().notEmpty().isLength({ max: 10 }),
  body('name').isString().trim().notEmpty().isLength({ max: 100 }),
];

router.get('/', asyncHandler(controller.list));

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
