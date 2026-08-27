const NOTIFICATION_TYPES = Object.freeze({
  CERTIFICATE_EXPIRING: 'CERTIFICATE_EXPIRING',
  CERTIFICATE_EXPIRED: 'CERTIFICATE_EXPIRED',
  VERIFICATION_SCHEDULED: 'VERIFICATION_SCHEDULED',
  APPLICATION_UPDATE: 'APPLICATION_UPDATE',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
});

const NOTIFICATION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  READ: 'READ',
  FAILED: 'FAILED',
});

function isValidNotificationType(type) {
  return Object.values(NOTIFICATION_TYPES).includes(type);
}

function isValidNotificationStatus(status) {
  return Object.values(NOTIFICATION_STATUSES).includes(status);
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  isValidNotificationType,
  isValidNotificationStatus,
};