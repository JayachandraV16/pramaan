// api/src/jobs/expiryReminders.js
//
// Sends "your certificate is about to expire" notifications.
//
// Reminder stages (days before valid_until): 30, 15, 7 and 1. A certificate in
// stage N gets ONE reminder for the smallest stage it has reached; reminder_log
// has UNIQUE (certificate_id, threshold_days) so running the job any number of
// times a day never repeats a reminder. The message always states the real
// number of days left. Recipients: the applicant and (if different) the
// instrument's owner.

const pool = require('../pool');
const { notify } = require('../utils/notify');
const audit = require('../utils/audit');

const THRESHOLDS = [30, 15, 7, 1];

function stageFor(daysLeft) {
  // smallest threshold that daysLeft has reached (daysLeft <= threshold)
  const reached = THRESHOLDS.filter((t) => daysLeft <= t);
  return reached.length > 0 ? Math.min(...reached) : null;
}

async function sendExpiryReminders() {
  const client = await pool.connect();
  let sent = 0;
  let certificates = 0;
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT vc.id, vc.certificate_number, vc.valid_until,
              (vc.valid_until - CURRENT_DATE) AS days_left,
              i.instrument_name, i.owner_id,
              app.id AS application_id, app.applicant_id
       FROM verification_certificates vc
       JOIN instruments i ON i.id = vc.instrument_id
       JOIN verifications v ON v.id = vc.verification_id
       JOIN verification_applications app ON app.id = v.application_id
       WHERE vc.status = 'ACTIVE'
         AND vc.valid_until >= CURRENT_DATE
         AND vc.valid_until <= CURRENT_DATE + $1::int
       ORDER BY vc.valid_until`,
      [Math.max(...THRESHOLDS)]
    );

    for (const cert of rows) {
      const stage = stageFor(Number(cert.days_left));
      if (!stage) continue;

      const { rows: inserted } = await client.query(
        `INSERT INTO reminder_log (certificate_id, threshold_days)
         VALUES ($1, $2)
         ON CONFLICT (certificate_id, threshold_days) DO NOTHING
         RETURNING id`,
        [cert.id, stage]
      );
      if (inserted.length === 0) continue; // already reminded at this stage

      certificates += 1;
      const days = Number(cert.days_left);
      const recipients = new Set([cert.applicant_id, cert.owner_id].filter(Boolean));
      for (const recipientId of recipients) {
        await notify(client, {
          recipientId,
          type: 'CERTIFICATE_EXPIRING',
          key: 'certificate.expiring',
          params: { number: cert.certificate_number, instrument: cert.instrument_name, days, date: String(cert.valid_until).slice(0, 10) },
          relatedApplicationId: cert.application_id,
          relatedCertificateId: cert.id,
        });
        sent += 1;
      }
    }

    if (certificates > 0) {
      await audit.record(client, {
        action: 'EXPIRY_REMINDERS_SENT',
        entityType: 'job',
        entityId: 'expiryReminders',
        details: { certificates, notifications: sent },
      });
    }

    await client.query('COMMIT');
    return { certificates, notifications: sent };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { sendExpiryReminders, stageFor, THRESHOLDS };
