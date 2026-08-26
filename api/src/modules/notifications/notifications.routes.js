// api/src/modules/notifications/notifications.routes.js
//
// STATUS: NOT STARTED — placeholder so app.js can mount every module now
// and individual routes can be filled in later without touching app.js
// or modules/index.js again (avoids merge conflicts).
// Picked up in Stage 4.

const express = require('express');
const authenticate = require('../../middleware/authMiddleware');
const ApiResponse = require('../../utils/ApiResponse');

const router = express.Router();

router.use(authenticate, (req, res) => {
  new ApiResponse(501, null, 'notifications module not implemented yet (Stage 4)').send(res);
});

module.exports = router;
