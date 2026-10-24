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

function isParticipant(user, participants) {
  if (user.role === ROLES.ADMIN) return true;
  if (participants.applicant_id === user.id || participants.owner_id === user.id) return true;
  return participants.officer_ids.includes(user.id);
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

// Everyone involved except the author.
function otherRecipients(participants, query, authorId) {
  const set = new Set([participants.applicant_id, participants.owner_id, query.raised_by_id, ...participants.officer_ids]);
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

  return withTransaction(async (client) => {
    const participants = await loadParticipants(data.applicationId, client);
    if (!isParticipant(user, participants)) {
      throw ApiError.forbidden('You are not a participant of this application');
    }

    const query = await repo.insertQuery(client, {
      applicationId: data.applicationId,
      raisedById: user.id,
      subject,
    });
    await repo.insertMessage(client, { queryId: query.id, authorId: user.id, body: message });

    await audit.record(client, {
      actorId: user.id,
      action: 'QUERY_OPENED',
      entityType: 'query',
      entityId: query.id,
      details: { applicationId: data.applicationId, subject },
    });

    for (const recipientId of otherRecipients(participants, query, user.id)) {
      await notify(client, {
        recipientId,
        type: 'QUERY_MESSAGE',
        title: `New query: ${subject}`,
        message: `Application ${participants.application_number}: ${message.slice(0, 200)}`,
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
    userId,
  });

  // awaiting needs participants per application; cache per application
  const cache = new Map();
  const out = [];
  for (const row of rows) {
    if (!cache.has(row.application_id)) {
      cache.set(row.application_id, await repo.findApplicationParticipants(row.application_id));
    }
    out.push(withAwaiting(row, cache.get(row.application_id)));
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
  };
}

async function addMessage(user, queryId, data) {
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

    for (const recipientId of otherRecipients(participants, query, user.id)) {
      await notify(client, {
        recipientId,
        type: 'QUERY_MESSAGE',
        title: `Reply on query: ${query.subject}`,
        message: `Application ${participants.application_number}: ${body.slice(0, 200)}`,
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
    if (user.role !== ROLES.ADMIN && query.raised_by_id !== user.id) {
      throw ApiError.forbidden('Only the person who opened a query, or an administrator, can close it');
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

module.exports = { createQuery, listQueries, getQuery, addMessage, closeQuery };
