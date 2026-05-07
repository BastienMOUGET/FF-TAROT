const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./teams.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const playersRule = [
  body('players')
    .isArray({ min: 4, max: 4 })
    .withMessage('players doit contenir exactement 4 entrées'),
  body('players.*.player_id').isInt({ min: 1 }),
  body('players.*.pair')
    .isIn(['NS', 'EO'])
    .withMessage("pair doit être 'NS' ou 'EO'"),
];

router.get('/', asyncHandler(controller.listBySubTournament));

router.get('/:id', idParam, validate, asyncHandler(controller.getById));

router.post(
  '/',
  [
    body('sub_tournament_id').optional({ nullable: true }).isInt({ min: 1 }),
    ...playersRule,
  ],
  validate,
  asyncHandler(controller.create)
);

router.delete('/:id', idParam, validate, asyncHandler(controller.remove));

module.exports = router;
