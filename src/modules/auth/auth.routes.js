const express = require('express');
const { body, param } = require('express-validator');

const controller = require('./auth.controller');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
const usersRouter = express.Router();

const idParam = [param('id').isInt({ min: 1 }).withMessage('id invalide')];

// --- Public ---
router.post(
  '/login',
  [
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
  ],
  validate,
  asyncHandler(controller.login)
);

// --- Authenticated (any role) ---
router.get('/me', requireAuth, asyncHandler(controller.me));

router.put(
  '/me/password',
  requireAuth,
  [body('new_password').isString().isLength({ min: 6 })],
  validate,
  asyncHandler(controller.changeMyPassword)
);

// --- Admin only : user management ---
usersRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(controller.listUsers)
);

usersRouter.get(
  '/:id',
  requireRole('admin'),
  idParam,
  validate,
  asyncHandler(controller.getUser)
);

usersRouter.post(
  '/',
  requireRole('admin'),
  [
    body('username').isString().trim().isLength({ min: 3, max: 50 }),
    body('password').isString().isLength({ min: 6 }),
    body('role').isIn(['admin', 'arbitre', 'viewer']),
    body('full_name').optional({ nullable: true, checkFalsy: true })
      .isString().isLength({ max: 150 }),
    body('email').optional({ nullable: true, checkFalsy: true })
      .isEmail(),
  ],
  validate,
  asyncHandler(controller.createUser)
);

usersRouter.put(
  '/:id/password',
  requireRole('admin'),
  [...idParam, body('new_password').isString().isLength({ min: 6 })],
  validate,
  asyncHandler(controller.changeUserPassword)
);

usersRouter.delete(
  '/:id',
  requireRole('admin'),
  idParam,
  validate,
  asyncHandler(controller.deleteUser)
);

module.exports = { router, usersRouter };
