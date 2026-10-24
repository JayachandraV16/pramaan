// api/src/modules/documents/documents.service.js
//
// Required supporting documents for an application.
//   - ADMIN defines requirements (document_requirements); each can be limited to an
//     application type, instrument origin and applicant category (NULL = any).
//   - Uploads carry a document_type (attachments.document_type); the checklist
//     compares what the application needs with what has been uploaded.
//   - Assigning an officer is refused while a required document is missing
//     (assertRequirementsMet, called by the assignments service).

const pool = require('../../pool');
const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const attachmentsRepo = require('../attachments/attachments.repository');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_RE = /^[A-Z][A-Z0-9_]{1,49}$/;
const APPLICATION_TYPES = ['VERIFICATION', 'RE_VERIFICATION'];
const ORIGINS = ['LOCAL', 'IMPORTED'];
const APPLICANT_TYPES = ['MANUFACTURER', 'DEALER', 'USER', 'REPAIRER', 'IMPORTER'];

function normaliseType(value) {
  const t = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!TYPE_RE.test(t)) throw ApiError.badRequest('documentType must be 2-50 letters, digits or underscores (e.g. MODEL_APPROVAL)');
  return t;
}

function oneOf(value, allowed, field) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).toUpperCase();
  if (!allowed.includes(v)) throw ApiError.badRequest(`${field} must be one of ${allowed.join(', ')}`);
  return v;
}

async function listRequirements() {
  const { rows } = await pool.query('SELECT * FROM document_requirements ORDER BY document_type, created_at');
  return rows;
}

async function createRequirement(user, data) {
  const documentType = normaliseType(data.documentType);
  const label = typeof data.label === 'string' ? data.label.trim() : '';
  if (!label || label.length > 200) throw ApiError.badRequest('label is required (max 200 characters)');
  const labelHi = typeof data.labelHi === 'string' && data.labelHi.trim() ? data.labelHi.trim().slice(0, 200) : null;
  const applicationType = oneOf(data.applicationType, APPLICATION_TYPES, 'applicationType');
  const instrumentOrigin = oneOf(data.instrumentOrigin, ORIGINS, 'instrumentOrigin');
  const applicantType = oneOf(data.applicantType, APPLICANT_TYPES, 'applicantType');

  return withTransaction(async (client) => {
    let row;
    try {
      ({ rows: [row] } = await client.query(
        `INSERT INTO document_requirements (document_type, label, label_hi, application_type, instrument_origin, applicant_type, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [documentType, label, labelHi, applicationType, instrumentOrigin, applicantType, user.id]
      ));
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('That requirement already exists for the same scope');
      throw err;
    }
    await audit.record(client, {
      actorId: user.id, action: 'DOCUMENT_REQUIREMENT_CREATED', entityType: 'document_requirement', entityId: row.id,
      details: { documentType, applicationType, instrumentOrigin, applicantType },
    });
    return row;
  });
}

async function updateRequirement(user, id, data) {
  if (!UUID_RE.test(id)) throw ApiError.notFound('Requirement not found');
  const label = data.label === undefined ? null : String(data.label).trim();
  if (data.label !== undefined && (!label || label.length > 200)) throw ApiError.badRequest('label must be 1-200 characters');
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw ApiError.badRequest('isActive must be true or false');

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE document_requirements
          SET label = COALESCE($2, label), label_hi = COALESCE($3, label_hi), is_active = COALESCE($4, is_active)
        WHERE id = $1 RETURNING *`,
      [id, label, typeof data.labelHi === 'string' ? data.labelHi.trim().slice(0, 200) : null, data.isActive ?? null]
    );
    if (!rows[0]) throw ApiError.notFound('Requirement not found');
    await audit.record(client, {
      actorId: user.id, action: 'DOCUMENT_REQUIREMENT_UPDATED', entityType: 'document_requirement', entityId: id,
      details: { label: data.label, isActive: data.isActive },
    });
    return rows[0];
  });
}

async function applicationContext(applicationId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.application_type, a.instrument_origin, u.applicant_type
       FROM verification_applications a JOIN users u ON u.id = a.applicant_id
      WHERE a.id = $1`,
    [applicationId]
  );
  return rows[0] || null;
}

// Requirements that apply to the application, with whether each has an upload.
async function buildChecklist(applicationId) {
  const ctx = await applicationContext(applicationId);
  if (!ctx) throw ApiError.notFound('Application not found');

  const { rows: required } = await pool.query(
    `SELECT DISTINCT ON (document_type) document_type, label, label_hi
       FROM document_requirements
      WHERE is_active
        AND (application_type IS NULL OR application_type = $1)
        AND (instrument_origin IS NULL OR instrument_origin = $2)
        AND (applicant_type IS NULL OR applicant_type = $3)
      ORDER BY document_type, (application_type IS NULL), (instrument_origin IS NULL), (applicant_type IS NULL)`,
    [ctx.application_type, ctx.instrument_origin, ctx.applicant_type]
  );
  const { rows: uploads } = await pool.query(
    `SELECT DISTINCT ON (document_type) document_type, id, file_name, uploaded_at
       FROM attachments WHERE application_id = $1 AND document_type IS NOT NULL
      ORDER BY document_type, uploaded_at DESC`,
    [applicationId]
  );
  const byType = new Map(uploads.map((u) => [u.document_type, u]));

  const items = required.map((r) => {
    const up = byType.get(r.document_type);
    return {
      documentType: r.document_type,
      label: r.label,
      labelHi: r.label_hi,
      satisfied: !!up,
      attachmentId: up ? up.id : null,
      fileName: up ? up.file_name : null,
    };
  });
  return { applicationId, items, missing: items.filter((i) => !i.satisfied).map((i) => i.documentType), complete: items.every((i) => i.satisfied) };
}

async function getChecklist(user, applicationId) {
  if (!UUID_RE.test(applicationId)) throw ApiError.notFound('Application not found');
  if (user.role !== ROLES.ADMIN) {
    const allowed =
      (await attachmentsRepo.isApplicationOwner(applicationId, user.id)) ||
      (await attachmentsRepo.isAssignedToApplication(applicationId, user.id));
    if (!allowed) throw ApiError.forbidden('You do not have access to this application');
  }
  return buildChecklist(applicationId);
}

// Used by the assignments service: no officer until the paperwork is complete.
async function assertRequirementsMet(applicationId) {
  const checklist = await buildChecklist(applicationId);
  if (!checklist.complete) {
    const labels = checklist.items.filter((i) => !i.satisfied).map((i) => i.label);
    throw ApiError.conflict(`Required documents are missing: ${labels.join(', ')}`);
  }
}

module.exports = {
  listRequirements, createRequirement, updateRequirement, getChecklist, assertRequirementsMet, normaliseType,
};
