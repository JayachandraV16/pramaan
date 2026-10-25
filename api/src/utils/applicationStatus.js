// api/src/utils/applicationStatus.js
//
// The ONLY place an application's status is changed. It enforces the allowed
// transitions and writes application_status_history (and the caller supplies
// the transaction client so the change commits with whatever caused it).
//
//   DRAFT        -> SUBMITTED, CANCELLED
//   SUBMITTED    -> UNDER_REVIEW, REJECTED, CANCELLED
//   UNDER_REVIEW -> UNDER_REVIEW (re-assignment), SCHEDULED, COMPLETED, REJECTED, CANCELLED
//   SCHEDULED    -> SCHEDULED (reschedule), UNDER_REVIEW, COMPLETED, REJECTED, CANCELLED
//   COMPLETED / REJECTED / CANCELLED are final: a new application is needed.

const ApiError = require('./ApiError');

const ALLOWED = Object.freeze({
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['UNDER_REVIEW', 'SCHEDULED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
  SCHEDULED: ['SCHEDULED', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
});

function canTransition(from, to) {
  return (ALLOWED[from] || []).includes(to);
}

async function transition(client, applicationId, toStatus, { actorId = null, reason = null } = {}) {
  const { rows } = await client.query(
    'SELECT id, status FROM verification_applications WHERE id = $1 FOR UPDATE',
    [applicationId]
  );
  const application = rows[0];
  if (!application) throw ApiError.notFound('Application not found');

  const from = application.status;
  if (!canTransition(from, toStatus)) {
    throw ApiError.conflict(`Application cannot move from ${from} to ${toStatus}`);
  }

  // submitted_at must be set once an application leaves DRAFT (DB check).
  await client.query(
    `UPDATE verification_applications
     SET status = $2,
         submitted_at = CASE WHEN $2::application_status <> 'DRAFT' THEN COALESCE(submitted_at, now()) ELSE submitted_at END
     WHERE id = $1`,
    [applicationId, toStatus]
  );

  if (from !== toStatus) {
    await client.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [applicationId, from, toStatus, actorId, reason]
    );
  }
  return { from, to: toStatus };
}

module.exports = { transition, canTransition, ALLOWED };
