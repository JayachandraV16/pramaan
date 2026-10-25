// api/src/modules/queries/queries.service.js
//
// Clarification threads about an application, between the applicant/owner and
// department staff (ADMIN, assigned LMO/GATC).
//
//   - either side can open a thread and reply
//   - every new message notifies the other participants (QUERY_MESSAGE)
//   - the person who opened a thread, or an ADMIN, can close it; closed
//     threads accept no more messages
//   - `awaiting` tells the UI whose turn it is: APPLICANT when staff wrote
//     last, DEPARTMENT when the applicant did

const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');
const { withTransaction } = require('../../utils/db');
const { ROLES } = require('../../config/roles');
const repo = require('./queries.repository');

const MAX_SUBJECT = 200;
const MAX_BODY = 4000;
const KINDS = ['CLARIFICATION', 'DOCUMENT_REQUEST'];
const MAX_REQUESTED_ITEMS = 10;
const MAX_ITEM_LENGTH = 120;

const isStaff = (user) => user.role === ROLES.ADMIN || user.role === ROLES.LMO || user.role === ROLES.GATC;

function cleanKind(value) {
  const kind = value === undefined || value === null || value === '' ? 'CLARIFICATION' : String(value).toUpperCase();
  if (!KINDS.includes(kind)) throw ApiError.badRequest(`kind must be one of ${KINDS.join(', ')}`);
  return kind;
}

// The documents a department asks for: 1-10 short lines of text.
function cleanRequestedItems(kind, value) {
  if (kind !== 'DOCUMENT_REQUEST') {
    if (Array.isArray(value) && value.length) throw ApiError.badRequest('requestedItems is only for document requests');
    return [];
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REQUESTED_ITEMS) {
    throw ApiError.badRequest(`List between 1 and ${MAX_REQUESTED_ITEMS} documents in requestedItems`);
  }
  return value.map((item) => {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text || text.length > MAX_ITEM_LENGTH) throw ApiError.badRequest(`Each requested document needs a name of at most ${MAX_ITEM_LENGTH} characters`);
    return text;
  });
}

function isParticipant(user, participants) {
  if (user.role === ROLES.ADMIN) return true;
  if (participants.applicant_id === user.id || participants.owner_id === user.id) return true;
  return participants.officer_ids.includes(user.id);
}

// Resolving (closing / reopening) belongs to the department: an administrator or an officer currently
// assigned to the application. Applicants can ask, reply and attach files, but never resolve.
function canResolve(user, participants) {
  if (user.role === ROLES.ADMIN) return true;
  return (user.role === ROLES.LMO || user.role === ROLES.GATC) && participants.officer_ids.includes(user.id);
}

function isApplicantSide(userId, participants) {
  return participants.applicant_id === userId || participants.owner_id === userId;
}

function cleanText(value, label, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw ApiError.badRequest(`${label} is required`);
  if (text.length > max) throw ApiError.badRequest(`${label} must be at most ${max} characters`);
  return text;
}

async function loadParticipants(applicationId, client) {
  const participants = await repo.findApplicationParticipants(applicationId, client);
  if (!participants) throw ApiError.notFound('Application not found');
  return participants;
}

// Everyone involved except the author. When nobody from the department is assigned yet, the
// administrators are included so an applicant's question is never left unseen.
async function otherRecipients(participants, query, authorId, client) {
  const set = new Set([participants.applicant_id, participants.owner_id, query.raised_by_id, ...participants.officer_ids]);
  if (participants.officer_ids.length === 0 && isApplicantSide(authorId, participants)) {
    for (const adminId of await repo.findActiveAdminIds(client)) set.add(adminId);
  }
  set.delete(authorId);
  set.delete(null);
  set.delete(undefined);
  return [...set];
}

function withAwaiting(query, participants) {
  if (query.status === 'CLOSED') return { ...query, awaiting: null };
  const lastAuthor = query.last_author_id;
  if (!lastAuthor) return { ...query, awaiting: null };
  return { ...query, awaiting: isApplicantSide(lastAuthor, participants) ? 'DEPARTMENT' : 'APPLICANT' };
}

async function createQuery(user, data) {
  if (user.role === ROLES.PUBLIC_USER) throw ApiError.forbidden('Not allowed');
  const subject = cleanText(data.subject, 'subject', MAX_SUBJECT);
  const message = cleanText(data.message, 'message', MAX_BODY);
  const kind = cleanKind(data.kind);
  if (kind === 'DOCUMENT_REQUEST' && !isStaff(user)) {
    throw ApiError.forbidden('Only the department can request documents from an applicant');
  }
  const requestedItems = cleanRequestedItems(kind, data.requestedItems);

  return withTransaction(async (client) => {
    const participants = await loadParticipants(data.applicationId, client);
    if (!isParticipant(user, participants)) {
      throw ApiError.forbidden('You are not a participant of this application');
    }

    const query = await repo.insertQuery(client, {
      applicationId: data.applicationId,
      raisedById: user.id,
      subject,
      kind,
      requestedItems,
    });
    await repo.insertMessage(client, { queryId: query.id, authorId: user.id, body: message });

    await audit.record(client, {
      actorId: user.id,
      action: 'QUERY_OPENED',
      entityType: 'query',
      entityId: query.id,
      details: { applicationId: data.applicationId, subject, kind, requestedItems },
    });

    for (const recipientId of await otherRecipients(participants, query, user.id, client)) {
      await notify(client, {
        recipientId,
        type: 'QUERY_MESSAGE',
        title: kind === 'DOCUMENT_REQUEST' ? `Documents requested: ${subject}` : `New query: ${subject}`,
        message:
          kind === 'DOCUMENT_REQUEST'
            ? `Application ${participants.application_number}: please send ${requestedItems.join(', ')}. ${message.slice(0, 160)}`
            : `Application ${participants.application_number}: ${message.slice(0, 200)}`,
        relatedApplicationId: data.applicationId,
      });
    }

    return query;
  });
}

async function listQueries(user, filters) {
  const userId = user.role === ROLES.ADMIN ? null : user.id;
  const rows = await repo.listQueries({
    applicationId: filters.applicationId,
    status: filters.status ? String(filters.status).toUpperCase() : null,
    kind: filters.kind ? cleanKind(filters.kind) : null,
    userId,
  });

  // awaiting needs participants per application; cache per application
  const cache = new Map();
  const out = [];
  for (const row of rows) {
    if (!cache.has(row.application_id)) {
      cache.set(row.application_id, await repo.findApplicationParticipants(row.application_id));
    }
    const item = { ...withAwaiting(row, cache.get(row.application_id)), can_close: canResolve(user, cache.get(row.application_id)) };
    // awaiting=me keeps the threads where the next move belongs to this person's side
    if (String(filters.awaiting || '').toLowerCase() === 'me') {
      const mySide = isApplicantSide(user.id, cache.get(row.application_id)) ? 'APPLICANT' : 'DEPARTMENT';
      if (item.awaiting !== mySide) continue;
    }
    out.push(item);
  }
  return out;
}

async function getQuery(user, queryId) {
  const query = await repo.findQueryById(queryId);
  if (!query) throw ApiError.notFound('Query not found');
  const participants = await loadParticipants(query.application_id);
  if (!isParticipant(user, participants)) {
    throw ApiError.forbidden('You do not have access to this query');
  }
  const messages = await repo.findMessages(queryId);
  const last = messages[messages.length - 1];
  return {
    ...withAwaiting({ ...query, last_author_id: last ? last.author_id : null }, participants),
    application_number: participants.application_number,
    messages,
    can_close: canResolve(user, participants),
    history: await repo.findHistory(queryId),
  };
}

async function addMessage(user, queryId, data, file = null) {
  const body = cleanText(data.body, 'body', MAX_BODY);

  return withTransaction(async (client) => {
    // lock the thread so a concurrent close cannot be missed
    const { rows } = await client.query('SELECT * FROM application_queries WHERE id = $1 FOR UPDATE', [queryId]);
    const query = rows[0];
    if (!query) throw ApiError.notFound('Query not found');

    const participants = await loadParticipants(query.application_id, client);
    if (!isParticipant(user, participants)) {
      throw ApiError.forbidden('You do not have access to this query');
    }
    if (query.status === 'CLOSED') {
      throw ApiError.conflict('This query is closed');
    }

    const message = await repo.insertMessage(client, { queryId, authorId: user.id, body });
    message.attachments = [];
    if (file) {
      message.attachments.push(await repo.insertReplyAttachment(client, { query, messageId: message.id, userId: user.id, file }));
    }
    await audit.record(client, {
      actorId: user.id,
      action: 'QUERY_REPLIED',
      entityType: 'query',
      entityId: queryId,
      details: { applicationId: query.application_id, attachmentSha256: file ? file.sha256 : null },
    });

    for (const recipientId of await otherRecipients(participants, query, user.id, client)) {
      await notify(client, {
        recipientId,
        type: 'QUERY_MESSAGE',
        title: `Reply on query: ${query.subject}`,
        message: `Application ${participants.application_number}: ${body.slice(0, 200)}${file ? ' (file attached)' : ''}`,
        relatedApplicationId: query.application_id,
      });
    }

    return message;
  });
}

async function closeQuery(user, queryId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM application_queries WHERE id = $1 FOR UPDATE', [queryId]);
    const query = rows[0];
    if (!query) throw ApiError.notFound('Query not found');

    const participants = await loadParticipants(query.application_id, client);
    if (!isParticipant(user, participants)) {
      throw ApiError.forbidden('You do not have access to this query');
    }
    if (!canResolve(user, participants)) {
      throw ApiError.forbidden('Only an administrator or the officer assigned to this application can resolve or close a query');
    }
    if (query.status === 'CLOSED') return query;

    const closed = await repo.closeQuery(client, queryId, user.id);
    await audit.record(client, {
      actorId: user.id,
      action: 'QUERY_CLOSED',
      entityType: 'query',
      entityId: queryId,
      details: { applicationId: query.application_id },
    });
    return closed;
  });
}

// The department (or an administrator) can reopen a closed thread, for example when the answer was not enough.
async function reopenQuery(user, queryId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM application_queries WHERE id = $1 FOR UPDATE', [queryId]);
    const query = rows[0];
    if (!query) throw ApiError.notFound('Query not found');

    const participants = await loadParticipants(query.application_id, client);
    if (!isParticipant(user, participants)) throw ApiError.forbidden('You do not have access to this query');
    if (!canResolve(user, participants)) throw ApiError.forbidden('Only an administrator or the officer assigned to this application can reopen a query');
    if (query.status === 'OPEN') return query;

    const reopened = await repo.reopenQuery(client, queryId);
    await audit.record(client, {
      actorId: user.id,
      action: 'QUERY_REOPENED',
      entityType: 'query',
      entityId: queryId,
      details: { applicationId: query.application_id },
    });
    for (const recipientId of await otherRecipients(participants, query, user.id, client)) {
      await notify(client, {
        recipientId,
        type: 'QUERY_MESSAGE',
        title: `Query reopened: ${query.subject}`,
        message: `Application ${participants.application_number}: the department reopened this query.`,
        relatedApplicationId: query.application_id,
      });
    }
    return reopened;
  });
}

module.exports = { createQuery, listQueries, getQuery, addMessage, closeQuery, reopenQuery, KINDS };
