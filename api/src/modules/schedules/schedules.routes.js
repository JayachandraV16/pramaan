const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./schedules.controller');

const {
  createScheduleRules,
  updateScheduleStatusRules,
} = require('./schedules.validation');

const router = express.Router();

// All schedule routes require authentication
router.use(authenticate);

// Create a schedule
// ADMIN creates the verification schedule
router.post(
  '/',
  authorize(ROLES.ADMIN),
  validateBody(createScheduleRules),
  controller.createSchedule
);

// Get schedules
// ADMIN -> all schedules
// LMO/GATC -> their own schedules
router.get(
  '/',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getSchedules
);

// Get one schedule
router.get(
  '/:id',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getScheduleById
);

// Update schedule status
router.patch(
  '/:id/status',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(updateScheduleStatusRules),
  controller.updateScheduleStatus
);

module.exports = router;