// api/src/utils/notify.js
//
// Creates in-app notifications from inside services/jobs. Takes a db client so
// the notification commits (or rolls back) together with the change that
// caused it. In-app delivery is immediate, so rows are stored as SENT; an
// email/SMS channel can later pick up rows by type and mark them itself.

async function notify(
  client,
  { recipientId, type, title, message, relatedApplicationId = null, relatedCertificateId = null }
) {
  if (!recipientId) return null;
  const { rows } = await client.query(
    `INSERT INTO notifications (
       recipient_id, type, title, message, status, sent_at,
       related_application_id, related_certificate_id
     )
     VALUES ($1, $2, $3, $4, 'SENT', now(), $5, $6)
     RETURNING id`,
    [recipientId, type, title, message, relatedApplicationId, relatedCertificateId]
  );
  return rows[0];
}

module.exports = { notify };
