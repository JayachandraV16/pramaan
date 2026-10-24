// api/src/modules/queries/queries.repository.js

const pool = require('../../pool');

// Who may take part in queries about an application: ADMIN, the applicant and
// instrument owner, and every officer ever assigned to it.
async function findApplicationParticipants(applicationId, client = pool) {
  const { rows } = await client.query(
    `SELECT a.id, a.application_number, a.applicant_id, i.owner_id,
            COALESCE(
              (SELECT array_agg(DISTINCT s.assigned_to_id) FROM verification_assignments s
               WHERE s.application_id = a.id),
              ARRAY[]::uuid[]
            ) AS officer_ids
     FROM verification_applications a
     JOIN instruments i ON i.id = a.instrument_id
     WHERE a.id = $1`,
    [applicationId]
  );
  return rows[0] || null;
}

async function insertQuery(client, { applicationId, raisedById, subject }) {
  const { rows } = await client.query(
    `INSERT INTO application_queries (application_id, raised_by_id, subject)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [applicationId, raisedById, subject]
  );
  return rows[0];
}

async function insertMessage(client, { queryId, authorId, body }) {
  const { rows } = await client.query(
    `INSERT INTO application_query_messages (query_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [queryId, authorId, body]
  );
  // keep updated_at current so threads sort by latest activity
  await client.query('UPDATE application_queries SET updated_at = now() WHERE id = $1', [queryId]);
  return rows[0];
}

async function findQueryById(id, client = pool) {
  const { rows } = await client.query('SELECT * FROM application_queries WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findMessages(queryId) {
  const { rows } = await pool.query(
    `SELECT m.id, m.query_id, m.author_id, m.body, m.created_at,
            u.full_name AS author_name, r.name AS author_role
     FROM application_query_messages m
     JOIN users u ON u.id = m.author_id
     JOIN roles r ON r.id = u.role_id
     WHERE m.query_id = $1
     ORDER BY m.created_at ASC, m.id ASC`,
    [queryId]
  );
  return rows;
}

// Threads with their last message, filtered by application / status and by
// what the caller is allowed to see (userId = NULL means ADMIN: everything).
async function listQueries({ applicationId, status, userId }) {
  const { rows } = await pool.query(
    `SELECT q.*, a.application_number,
            (SELECT COUNT(*)::int FROM application_query_messages m WHERE m.query_id = q.id) AS message_count,
            lm.author_id AS last_author_id, lm.created_at AS last_message_at,
            lm.body AS last_message
     FROM application_queries q
     JOIN verification_applications a ON a.id = q.application_id
     JOIN instruments i ON i.id = a.instrument_id
     LEFT JOIN LATERAL (
       SELECT m.author_id, m.created_at, m.body
       FROM application_query_messages m WHERE m.query_id = q.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1
     ) lm ON TRUE
     WHERE ($1::uuid IS NULL OR q.application_id = $1::uuid)
       AND ($2::query_status IS NULL OR q.status = $2::query_status)
       AND ($3::uuid IS NULL
            OR a.applicant_id = $3::uuid
            OR i.owner_id = $3::uuid
            OR EXISTS (SELECT 1 FROM verification_assignments s
                       WHERE s.application_id = a.id AND s.assigned_to_id = $3::uuid))
     ORDER BY q.updated_at DESC`,
    [applicationId || null, status || null, userId || null]
  );
  return rows;
}

async function closeQuery(client, id, userId) {
  const { rows } = await client.query(
    `UPDATE application_queries
     SET status = 'CLOSED', closed_at = now(), closed_by_id = $2
     WHERE id = $1
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}

module.exports = {
  findApplicationParticipants,
  insertQuery,
  insertMessage,
  findQueryById,
  findMessages,
  listQueries,
  closeQuery,
};
