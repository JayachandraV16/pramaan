const service = require('./notifications.service');
const ApiResponse = require('../../utils/ApiResponse');

// Create notification
async function createNotification(req, res, next) {
  try {
    const notification = await service.createNotification(
      req.user,
      req.body
    );

    new ApiResponse(
      201,
      notification,
      'Notification created successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Get my notifications
async function getMyNotifications(req, res, next) {
  try {
    const notifications =
      await service.getMyNotifications(req.user);

    new ApiResponse(
      200,
      notifications,
      'Notifications retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Get notification by ID
async function getNotificationById(req, res, next) {
  try {
    const notification =
      await service.getNotificationById(
        req.user,
        req.params.id
      );

    new ApiResponse(
      200,
      notification,
      'Notification retrieved successfully'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Mark one notification as read
async function markNotificationAsRead(req, res, next) {
  try {
    const notification =
      await service.markNotificationAsRead(
        req.user,
        req.params.id
      );

    new ApiResponse(
      200,
      notification,
      'Notification marked as read'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

// Mark all my notifications as read
async function markAllNotificationsAsRead(
  req,
  res,
  next
) {
  try {
    const notifications =
      await service.markAllNotificationsAsRead(
        req.user
      );

    new ApiResponse(
      200,
      notifications,
      'All notifications marked as read'
    ).send(res);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createNotification,
  getMyNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};