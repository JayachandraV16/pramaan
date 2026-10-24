// api/src/jobs/certificateLifecycle.js
//
// Marks ACTIVE certificates whose valid_until date has passed as EXPIRED.
// Idempotent: running it twice in a row changes nothing the second time.
// Each change is audited and the applicant is notified, all in one
// transaction per run. Public verification does not depend on this job (it
// compares dates itself), but dashboards and reports do.

const pool = require('../pool');
const audit = require('../utils/audit');
const { notify } = require('../utils/notify');

async function expireDueCertificates() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: due } = await client.query(
      `SELECT vc.id, vc.certificate_number, vc.valid_until,
              app.id AS application_id, app.applicant_id, i.instrument_name
       FROM verification_certificates vc
       JOIN verifications v ON v.id = vc.verification_id
       JOIN verification_applications app ON app.id = v.application_id
       JOIN instruments i ON i.id = vc.instrument_id
       WHERE vc.status = 'ACTIVE' AND vc.valid_until < CURRENT_DATE
       ORDER BY vc.valid_until
       FOR UPDATE OF vc`
    );

    for (const cert of due) {
      await client.query(
        "UPDATE verification_certificates SET status = 'EXPIRED' WHERE id = $1",
        [cert.id]
      );
      await audit.record(client, {
        action: 'CERTIFICATE_EXPIRED_AUTO',
        entityType: 'certificate',
        entityId: cert.id,
        details: { certificateNumber: cert.certificate_number, validUntil: cert.valid_until },
      });
      await notify(client, {
        recipientId: cert.applicant_id,
        type: 'CERTIFICATE_EXPIRED',
        key: 'certificate.expired',
        params: { number: cert.certificate_number, instrument: cert.instrument_name },
        relatedApplicationId: cert.application_id,
        relatedCertificateId: cert.id,
      });
    }

    await client.query('COMMIT');
    return { expired: due.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { expireDueCertificates };
