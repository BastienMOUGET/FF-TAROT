const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./sub-tournaments.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

// mergeParams: true so this router can be nested under /tournaments/:tournamentId
const router = express.Router({ mergeParams: true });

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

const bodyRules = [
  body('label').isString().trim().notEmpty().isLength({ max: 50 }),
  body('color')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 20 }),
  body('color_name')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 50 }),
];

// Used both as /tournaments/:tournamentId/sub-tournaments and as
// standalone /sub-tournaments/:id under the dedicated mount path.
router.get('/', asyncHandler(controller.listByTournament));

router.get('/:id', idParam, validate, asyncHandler(controller.getById));

router.post(
  '/',
  [
    body('tournament_id').optional({ nullable: true }).isInt({ min: 1 }),
    ...bodyRules,
  ],
  validate,
  asyncHandler(controller.create)
);

router.put(
  '/:id',
  [...idParam, ...bodyRules],
  validate,
  asyncHandler(controller.update)
);

router.delete('/:id', idParam, validate, asyncHandler(controller.remove));

module.exports = router;
