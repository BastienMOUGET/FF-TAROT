const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./movement-patterns.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('table_count')
    .isInt({ min: 0 })
    .withMessage('table_count >= 0 (0 = défaut)'),
  body('offset_n').optional().isInt(),
  body('offset_s').optional().isInt(),
  body('offset_e').optional().isInt(),
  body('offset_o').optional().isInt(),
  body('label')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 150 }),
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
