const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./donne-sets.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];
const donneParam = [
  param('donneNumber').isInt({ min: 1 }).withMessage('numéro de donne invalide'),
];

const SEATS = ['N', 'S', 'E', 'O', 'ECART'];

router.get('/', asyncHandler(controller.list));

router.get('/:id', idParam, validate, asyncHandler(controller.getById));

router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().isLength({ max: 150 }),
    body('nb_donne').isInt({ min: 1, max: 200 }),
  ],
  validate,
  asyncHandler(controller.create)
);

router.put(
  '/:id',
  [
    ...idParam,
    body('name').isString().trim().notEmpty().isLength({ max: 150 }),
  ],
  validate,
  asyncHandler(controller.rename)
);

router.delete('/:id', idParam, validate, asyncHandler(controller.remove));

router.get(
  '/:id/donnes/:donneNumber',
  [...idParam, ...donneParam],
  validate,
  asyncHandler(controller.getDonne)
);

router.post(
  '/:id/donnes/:donneNumber/regenerate',
  [...idParam, ...donneParam],
  validate,
  asyncHandler(controller.regenerate)
);

router.post(
  '/:id/donnes/:donneNumber/swap',
  [
    ...idParam,
    ...donneParam,
    body('seat_a').isIn(SEATS).withMessage('seat_a invalide'),
    body('seat_b').isIn(SEATS).withMessage('seat_b invalide'),
  ],
  validate,
  asyncHandler(controller.swap)
);

module.exports = router;
