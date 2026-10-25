// api/src/modules/users/users.routes.js
//
// Mounted at /api/users.
//   GET   /                 ADMIN  list users (?status=&role=&search=&page=&limit=)
//   POST  /                 ADMIN  create an account of any role
//   GET   /:id              ADMIN
//   PATCH /:id/status       ADMIN  approve / suspend / reactivate
//   PATCH /me               any    edit own profile
//   POST  /me/password      any    change own password
// "/me" routes are declared before "/:id" so they are not captured by it.

const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { rateLimit } = require('../../middleware/security');
const { ROLES } = require('../../config/roles');
const controller = require('./users.controller');
const {
  createUserRules,
  updateStatusRules,
  updateProfileRules,
  changePasswordRules,
} = require('./users.validation');

const router = express.Router();

router.use(authenticate);

router.patch('/me', validateBody(updateProfileRules), controller.updateOwnProfile);
router.post(
  '/me/password',
  rateLimit({ name: 'change-password', windowMs: 15 * 60 * 1000, max: 10 }),
  validateBody(changePasswordRules),
  controller.changeOwnPassword
);

router.get('/', authorize(ROLES.ADMIN), controller.listUsers);
router.post('/', authorize(ROLES.ADMIN), validateBody(createUserRules), controller.createUser);
router.get('/:id', authorize(ROLES.ADMIN), controller.getUser);
router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN),
  validateBody(updateStatusRules),
  controller.updateStatus
);

module.exports = router;
