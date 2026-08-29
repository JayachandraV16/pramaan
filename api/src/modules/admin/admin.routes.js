const express = require('express');
const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const { ROLES } = require('../../config/roles');
const controller = require('./admin.controller');

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/officers', controller.getActiveOfficers);

module.exports = router;