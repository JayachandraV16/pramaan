// Mounted at /api/auth in modules/index.js.
//   POST /api/auth/register  — public   — body: { fullName, password, role,
//                                                  email?, phone?,          (at least one of email/phone)
//                                                  organizationName?, address? }
//        INSTRUMENT_OWNER / PUBLIC_USER -> active, token returned.
//        LMO / GATC -> PENDING_APPROVAL, no token (ADMIN approves via /api/users/:id/status).
//        ADMIN -> rejected (403).
//   POST /api/auth/login     — public   — body: { email, password }
//   GET  /api/auth/me        — protected (Bearer token)

const express = require('express');
const controller = require('./auth.controller');
const authenticate = require('../../middleware/authMiddleware');
const validateBody = require('../../middleware/validate');
const { rateLimit } = require('../../middleware/security');
const { registerRules, loginRules } = require('./auth.validation');

const router = express.Router();

// 10 login attempts per 15 minutes per IP + email; 20 registrations per hour per IP.
const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => String(req.body?.email || '').toLowerCase(),
});
const registerLimiter = rateLimit({ name: 'register', windowMs: 60 * 60 * 1000, max: 20 });

router.post('/register', registerLimiter, validateBody(registerRules), controller.register);
router.post('/login', loginLimiter, validateBody(loginRules), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
