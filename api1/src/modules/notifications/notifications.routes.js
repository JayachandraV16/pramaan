const express = require('express');

const authenticate = require('../../middleware/authMiddleware');
const controller = require('./notifications.controller');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// ADMIN creates a notification
router.post(
  '/',
  controller.createNotification
);

// Get my notifications
router.get(
  '/',
  controller.getMyNotifications
);

// Mark all my notifications as read
// IMPORTANT: keep this before /:id
router.patch(
  '/read-all',
  controller.markAllNotificationsAsRead
);

// Get notification by ID
router.get(
  '/:id',
  controller.getNotificationById
);

// Mark one notification as read
router.patch(
  '/:id/read',
  controller.markNotificationAsRead
);

module.exports = router;