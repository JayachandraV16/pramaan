// api/src/utils/notify.js
//
// Creates in-app notifications from inside services/jobs. Takes a db client so
// the notification commits (or rolls back) together with the change that
// caused it. In-app delivery is immediate, so rows are stored as SENT; an
// email/SMS channel can later pick up rows by type and mark them itself.

const { render, normaliseLanguage } = require('./i18n');
const { enqueueDeliveries } = require('./delivery');

// Pass either { title, message } (fixed text, e.g. user-written content) or
// { key, params } to have the text rendered in the recipient's preferred language
// (see utils/i18n.js).
async function notify(
  client,
  { recipientId, type, title, message, key, params, relatedApplicationId = null, relatedCertificateId = null }
) {
  if (!recipientId) return null;
  if (key) {
    const { rows: pref } = await client.query('SELECT preferred_language FROM users WHERE id = $1', [recipientId]);
    ({ title, message } = render(normaliseLanguage(pref[0] && pref[0].preferred_language), key, params));
  }
  const { rows } = await client.query(
    `INSERT INTO notifications (
       recipient_id, type, title, message, status, sent_at,
       related_application_id, related_certificate_id
     )
     VALUES ($1, $2, $3, $4, 'SENT', now(), $5, $6)
     RETURNING id`,
    [recipientId, type, title, message, relatedApplicationId, relatedCertificateId]
  );
  await enqueueDeliveries(client, { id: rows[0].id, recipientId, type });
  return rows[0];
}

module.exports = { notify };
