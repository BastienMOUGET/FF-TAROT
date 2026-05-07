const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('./players.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('licence')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 20 }),
  body('name').isString().trim().notEmpty().isLength({ max: 100 }),
  body('firstname').isString().trim().notEmpty().isLength({ max: 100 }),
  body('club_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 10 }),
  body('gender')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['M', 'F'])
    .withMessage("gender doit être 'M' ou 'F'"),
  body('birth_year')
    .optional({ nullable: true })
    .isInt({ min: 1900, max: 2100 }),
];

router.get(
  '/',
  [
    query('search').optional().isString().isLength({ max: 100 }),
    query('club_id').optional().isInt({ min: 1 }),
    query('licence').optional().isString().isLength({ max: 20 }),
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
