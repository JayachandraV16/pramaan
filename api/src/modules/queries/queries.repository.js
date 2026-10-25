// api/src/modules/queries/queries.repository.js

const pool = require('../../pool');

// Who may take part in queries about an application: ADMIN, the applicant and
// instrument owner, and the officers CURRENTLY assigned to it (an assignment that was declined or
// reassigned away no longer counts, so that officer neither sees the thread nor can resolve it).
async function findApplicationParticipants(applicationId, client = pool) {
  const { rows } = await client.query(
    `SELECT a.id, a.application_number, a.applicant_id, i.owner_id,
            COALESCE(
              (SELECT array_agg(DISTINCT s.assigned_to_id) FROM verification_assignments s
               WHERE s.application_id = a.id AND s.status IN ('ASSIGNED', 'ACCEPTED', 'COMPLETED')),
              ARRAY[]::uuid[]
            ) AS officer_ids
     FROM verification_applications a
     JOIN instruments i ON i.id = a.instrument_id
     WHERE a.id = $1`,
    [applicationId]
  );
  return rows[0] || null;
}

// Active administrators: told about a query when no officer is assigned yet, so it is not left unseen.
async function findActiveAdminIds(client = pool) {
  const { rows } = await client.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'`
  );
  return rows.map((r) => r.id);
}

async function insertQuery(client, { applicationId, raisedById, subject, kind = 'CLARIFICATION', requestedItems = [] }) {
  const { rows } = await client.query(
    `INSERT INTO application_queries (application_id, raised_by_id, subject, kind, requested_items)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [applicationId, raisedById, subject, kind, requestedItems]
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
            u.full_name AS author_name, r.name AS author_role,
            COALESCE((SELECT json_agg(json_build_object(
                        'id', a.id, 'file_name', a.file_name, 'file_url', a.file_url,
                        'mime_type', a.mime_type, 'file_sha256', a.file_sha256) ORDER BY a.uploaded_at)
                        FROM attachments a WHERE a.query_message_id = m.id), '[]'::json) AS attachments
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
async function listQueries({ applicationId, status, kind, userId }) {
  const { rows } = await pool.query(
    `SELECT q.*, a.application_number, i.instrument_name, i.serial_number AS instrument_serial,
            ru.full_name AS raised_by_name,
            (SELECT COUNT(*)::int FROM application_query_messages m WHERE m.query_id = q.id) AS message_count,
            lm.author_id AS last_author_id, lm.created_at AS last_message_at,
            lm.body AS last_message
     FROM application_queries q
     JOIN verification_applications a ON a.id = q.application_id
     JOIN instruments i ON i.id = a.instrument_id
     JOIN users ru ON ru.id = q.raised_by_id
     LEFT JOIN LATERAL (
       SELECT m.author_id, m.created_at, m.body
       FROM application_query_messages m WHERE m.query_id = q.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1
     ) lm ON TRUE
     WHERE ($1::uuid IS NULL OR q.application_id = $1::uuid)
       AND ($2::query_status IS NULL OR q.status = $2::query_status)
       AND ($4::query_kind IS NULL OR q.kind = $4::query_kind)
       AND ($3::uuid IS NULL
            OR a.applicant_id = $3::uuid
            OR i.owner_id = $3::uuid
            OR EXISTS (SELECT 1 FROM verification_assignments s
                       WHERE s.application_id = a.id AND s.assigned_to_id = $3::uuid
                         AND s.status IN ('ASSIGNED', 'ACCEPTED', 'COMPLETED')))
     ORDER BY q.updated_at DESC`,
    [applicationId || null, status || null, userId || null, kind || null]
  );
  return rows;
}

async function insertReplyAttachment(client, { query, messageId, userId, file }) {
  const { rows } = await client.query(
    `INSERT INTO attachments (application_id, uploaded_by_id, category, file_name, file_url, mime_type,
                              file_size_bytes, file_sha256, query_message_id, description)
     VALUES ($1, $2, 'DOCUMENT', $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, file_name, file_url, mime_type, file_sha256`,
    [query.application_id, userId, file.fileName, file.fileUrl, file.mimeType, file.size ?? null, file.sha256, messageId, `Sent with the reply to: ${query.subject}`.slice(0, 500)]
  );
  return rows[0];
}

async function reopenQuery(client, id) {
  const { rows } = await client.query(
    `UPDATE application_queries SET status = 'OPEN', closed_at = NULL, closed_by_id = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function findHistory(queryId) {
  const { rows } = await pool.query(
    `SELECT l.action, l.occurred_at, u.full_name AS actor_name, r.name AS actor_role
       FROM audit_log l
       LEFT JOIN users u ON u.id = l.actor_id
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE l.entity_type = 'query' AND l.entity_id = $1
      ORDER BY l.id`,
    [queryId]
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
  findActiveAdminIds,
  insertQuery,
  insertMessage,
  findQueryById,
  findMessages,
  listQueries,
  closeQuery,
  reopenQuery,
  insertReplyAttachment,
  findHistory,
};
