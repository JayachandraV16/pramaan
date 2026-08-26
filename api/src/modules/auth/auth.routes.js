// api/src/modules/auth/auth.routes.js
//
// Mounted at /api/auth in modules/index.js.
//
//   POST /api/auth/register  — public   — body: { fullName, password, role,
//                                                  email?, phone?,          (at least one of email/phone)
//                                                  organizationName?, address? }
//   POST /api/auth/login     — public   — body: { email, password }
//   GET  /api/auth/me        — protected (Bearer token)

const express = require('express');
const controller = require('./auth.controller');
const authenticate = require('../../middleware/authMiddleware');
const validateBody = require('../../middleware/validate');
const { registerRules, loginRules } = require('./auth.validation');

const router = express.Router();

router.post('/register', validateBody(registerRules), controller.register);
router.post('/login', validateBody(loginRules), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
