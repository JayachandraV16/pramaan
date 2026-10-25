const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const authorize = require('../../middleware/rbacMiddleware');
const validateBody = require('../../middleware/validate');
const { ROLES } = require('../../config/roles');

const controller = require('./assignments.controller');

const {
  createAssignmentRules,
  updateAssignmentStatusRules,
} = require('./assignments.validation');

const router = express.Router();

// All assignment routes require authentication
router.use(authenticate);

// Create assignment
// Only ADMIN can assign an application to an LMO/GATC
router.post(
  '/',
  authorize(ROLES.ADMIN),
  validateBody(createAssignmentRules),
  controller.createAssignment
);

// Get assignments
// ADMIN -> all assignments
// LMO/GATC -> only assignments assigned to them
router.get(
  '/',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getAssignments
);

// Get available active LMO/GATC officers (for Admin assignment picker)
router.get(
  '/available-officers',
  authorize(ROLES.ADMIN),
  controller.getAvailableOfficers
);

// Get one assignment
router.get(
  '/:id',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  controller.getAssignmentById
);

// Update assignment status
// Assigned LMO/GATC can accept, decline, complete, etc.
// ADMIN is also allowed by the service layer
router.patch(
  '/:id/status',
  authorize(
    ROLES.ADMIN,
    ROLES.LMO,
    ROLES.GATC
  ),
  validateBody(updateAssignmentStatusRules),
  controller.updateAssignmentStatus
);

module.exports = router;