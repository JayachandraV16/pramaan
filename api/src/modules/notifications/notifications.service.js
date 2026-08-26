const ApiError = require('../../utils/ApiError');
const repo = require('./notifications.repository');
const {
  isValidNotificationType,
} = require('./notifications.validation');
const { ROLES } = require('../../config/roles');

// Create notification
async function createNotification(user, data) {
  // For now, only ADMIN can manually create notifications
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden(
      'Only ADMIN can create notifications'
    );
  }

  if (!data.recipientId) {
    throw ApiError.badRequest('recipientId is required');
  }

  if (!data.type) {
    throw ApiError.badRequest('type is required');
  }

  if (!data.title) {
    throw ApiError.badRequest('title is required');
  }

  if (!data.message) {
    throw ApiError.badRequest('message is required');
  }

  if (!isValidNotificationType(data.type)) {
    throw ApiError.badRequest(
      `Invalid notification type: ${data.type}`
    );
  }

  const recipient = await repo.findUserById(
    data.recipientId
  );

  if (!recipient) {
    throw ApiError.notFound('Recipient user not found');
  }

  return repo.createNotification({
    recipientId: data.recipientId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedApplicationId:
      data.relatedApplicationId || null,
    relatedCertificateId:
      data.relatedCertificateId || null,
  });
}

// Get my notifications
async function getMyNotifications(user) {
  return repo.findNotificationsByRecipientId(user.id);
}

// Get notification by ID
async function getNotificationById(user, notificationId) {
  const notification =
    await repo.findNotificationById(notificationId);

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  // A user can only access their own notification
  if (notification.recipient_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to view this notification'
    );
  }

  return notification;
}

// Mark one notification as READ
async function markNotificationAsRead(
  user,
  notificationId
) {
  const notification =
    await repo.findNotificationById(notificationId);

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  if (notification.recipient_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to update this notification'
    );
  }

  return repo.markNotificationAsRead(notificationId);
}

// Mark all my notifications as READ
async function markAllNotificationsAsRead(user) {
  return repo.markAllNotificationsAsRead(user.id);
}

module.exports = {
  createNotification,
  getMyNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};