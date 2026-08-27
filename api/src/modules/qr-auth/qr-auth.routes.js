const express = require('express');

const controller =
  require('./qr-auth.controller');

const router = express.Router();

// Public route — no authentication required
router.get(
  '/:token',
  controller.authenticateQr
);

module.exports = router;