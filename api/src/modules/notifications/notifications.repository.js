const pool = require('../../pool');

// Create notification
async function createNotification({
  recipientId,
  type,
  title,
  message,
  relatedApplicationId,
  relatedCertificateId,
}) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (
      recipient_id,
      type,
      title,
      message,
      related_application_id,
      related_certificate_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      recipientId,
      type,
      title,
      message,
      relatedApplicationId || null,
      relatedCertificateId || null,
    ]
  );

  return rows[0];
}

// Get all notifications for a user
async function findNotificationsByRecipientId(recipientId) {
  const { rows } = await pool.query(
    `SELECT *
     FROM notifications
     WHERE recipient_id = $1
     ORDER BY created_at DESC`,
    [recipientId]
  );

  return rows;
}

// Get notification by ID
async function findNotificationById(id) {
  const { rows } = await pool.query(
    `SELECT *
     FROM notifications
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

// Mark one notification as READ
async function markNotificationAsRead(id) {
  const { rows } = await pool.query(
    `UPDATE notifications
     SET status = 'READ',
         read_at = NOW(),
         sent_at = COALESCE(sent_at, NOW())
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return rows[0] || null;
}

// Mark all unread notifications as READ
async function markAllNotificationsAsRead(recipientId) {
  const { rows } = await pool.query(
    `UPDATE notifications
     SET status = 'READ',
         read_at = NOW(),
         sent_at = COALESCE(sent_at, NOW())
     WHERE recipient_id = $1
       AND status != 'READ'
     RETURNING *`,
    [recipientId]
  );

  return rows;
}

// Find user by ID
async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, full_name, email
     FROM users
     WHERE id = $1`,
    [id]
  );

  return rows[0] || null;
}

module.exports = {
  createNotification,
  findNotificationsByRecipientId,
  findNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  findUserById,
};