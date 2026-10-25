// Checkpoint 3: query inbox, document requests, replies with files, reopening and thread history.
// (The basic open / reply / close flow is covered in phase3.test.js and must keep working.)

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, newApplication, assignTo, ok } = require('./workflow');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  await h.stop();
});

const call = (method, path, token, body) => h.call(method, path, { token, body });
async function reply(token, queryId, body, file) {
  const base = await h.start();
  if (!file) return call('POST', `/api/queries/${queryId}/messages`, token, { body });
  const form = new FormData();
  form.append('body', body);
  form.append('file', new Blob([file.bytes], { type: file.type }), file.name);
  const res = await fetch(`${base}/api/queries/${queryId}/messages`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function assigned() {
  const { application } = await newApplication(actors);
  await assignTo(actors, application.id, actors.lmo);
  return application;
}

test('document request: only the department may ask, the list of documents is validated, the applicant is notified', async () => {
  const app = await assigned();
  const base = { applicationId: app.id, subject: 'Documents needed', message: 'Please send these before the visit.' };

  const asOwner = await call('POST', '/api/queries', actors.owner.token, { ...base, kind: 'DOCUMENT_REQUEST', requestedItems: ['Calibration certificate'] });
  assert.equal(asOwner.status, 403, 'an applicant cannot request documents');
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'DOCUMENT_REQUEST' })).status, 400, 'a request must list documents');
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'DOCUMENT_REQUEST', requestedItems: [] })).status, 400);
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'DOCUMENT_REQUEST', requestedItems: Array(11).fill('x') })).status, 400, 'at most 10');
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'DOCUMENT_REQUEST', requestedItems: ['  '] })).status, 400);
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, requestedItems: ['Invoice'] })).status, 400, 'items only belong to document requests');
  assert.equal((await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'SOMETHING' })).status, 400);

  const res = await call('POST', '/api/queries', actors.lmo.token, { ...base, kind: 'DOCUMENT_REQUEST', requestedItems: ['Calibration certificate', 'Purchase invoice'] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.kind, 'DOCUMENT_REQUEST');
  assert.deepEqual(res.body.data.requested_items, ['Calibration certificate', 'Purchase invoice']);

  const { rows } = await h.pool.query("SELECT title, message FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND type = 'QUERY_MESSAGE'", [actors.owner.id, app.id]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].title, /Documents requested/);
  assert.match(rows[0].message, /Calibration certificate, Purchase invoice/);

  // an ordinary clarification stays the default
  const plain = await ok(call('POST', '/api/queries', actors.owner.token, { ...base, subject: 'A question' }), 201, 'clarification');
  assert.equal(plain.kind, 'CLARIFICATION');
  assert.deepEqual(plain.requested_items, []);

  // the database refuses an empty document request even if the API is bypassed
  await assert.rejects(h.pool.query("INSERT INTO application_queries (application_id, raised_by_id, subject, kind) VALUES ($1, $2, 'x', 'DOCUMENT_REQUEST')", [app.id, actors.lmo.id]), /ck_application_queries_requested_items/);
});

test('replies can carry a file: stored with its fingerprint, shown in the thread, visible to the department, refused for outsiders', async () => {
  const app = await assigned();
  const q = await ok(call('POST', '/api/queries', actors.lmo.token, { applicationId: app.id, subject: 'Send the invoice', message: 'Please attach it.', kind: 'DOCUMENT_REQUEST', requestedItems: ['Invoice'] }), 201, 'open');

  const sent = await reply(actors.owner.token, q.id, 'Invoice attached.', { bytes: png, type: 'image/png', name: 'invoice.png' });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.data.attachments.length, 1);
  assert.match(sent.body.data.attachments[0].file_sha256, /^[0-9a-f]{64}$/);

  const thread = await ok(call('GET', `/api/queries/${q.id}`, actors.lmo.token), 200, 'thread');
  const last = thread.messages[thread.messages.length - 1];
  assert.equal(last.attachments.length, 1);
  assert.equal(last.attachments[0].file_name, 'invoice.png');
  assert.equal(thread.messages[0].attachments.length, 0);
  const url = `${await h.start()}${last.attachments[0].file_url}`;
  assert.equal((await fetch(url)).status, 200, 'the signed link opens the file');
  assert.equal((await fetch(url.split('?')[0])).status, 403, 'the bare path does not');

  // the file belongs to the application, so the usual attachment list shows it to the department
  const listed = await ok(call('GET', `/api/attachments/application/${app.id}`, actors.lmo.token), 200, 'attachments');
  assert.ok(listed.some((a) => a.file_name === 'invoice.png' && a.query_message_id === last.id));

  const { rows } = await h.pool.query("SELECT message FROM notifications WHERE recipient_id = $1 AND title LIKE 'Reply on query%'", [actors.lmo.id]);
  assert.ok(rows.some((r) => /file attached/.test(r.message)));

  // plain JSON replies still work and have no attachments
  const text = await ok(reply(actors.lmo.token, q.id, 'Thank you.'), 201, 'text reply');
  assert.deepEqual(text.attachments, []);

  // refusals keep no file and no message
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const before = (await h.pool.query('SELECT count(*)::int n FROM attachments')).rows[0].n;
  assert.equal((await reply(stranger.token, q.id, 'hi', { bytes: png, type: 'image/png', name: 'x.png' })).status, 403);
  assert.equal((await reply(actors.owner.token, q.id, 'bad type', { bytes: Buffer.from('MZ'), type: 'application/octet-stream', name: 'virus.exe' })).status, 400);
  assert.equal((await reply(actors.owner.token, q.id, 'fake png', { bytes: Buffer.from('this is not a png'), type: 'image/png', name: 'fake.png' })).status, 400);
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM attachments')).rows[0].n, before);
});

test('inbox: filters by whose turn it is, kind and status; outsiders see nothing', async () => {
  const app = await assigned();
  const doc = await ok(call('POST', '/api/queries', actors.lmo.token, { applicationId: app.id, subject: 'Docs', message: 'Send them', kind: 'DOCUMENT_REQUEST', requestedItems: ['Seal photo'] }), 201, 'doc request');
  const question = await ok(call('POST', '/api/queries', actors.owner.token, { applicationId: app.id, subject: 'When will you visit?', message: 'Date please' }), 201, 'question');

  const ids = (rows) => rows.map((r) => r.id);
  const ownerWaiting = await ok(call('GET', `/api/queries?awaiting=me&applicationId=${app.id}`, actors.owner.token), 200, 'owner inbox');
  assert.deepEqual(ids(ownerWaiting), [doc.id], 'the owner owes an answer to the document request only');
  const officerWaiting = await ok(call('GET', `/api/queries?awaiting=me&applicationId=${app.id}`, actors.lmo.token), 200, 'officer inbox');
  assert.deepEqual(ids(officerWaiting), [question.id], 'the officer owes an answer to the question only');
  assert.ok(officerWaiting[0].instrument_name && officerWaiting[0].application_number && officerWaiting[0].raised_by_name, 'rows describe the application');

  const onlyDocs = await ok(call('GET', `/api/queries?kind=DOCUMENT_REQUEST&applicationId=${app.id}`, actors.admin.token), 200, 'admin by kind');
  assert.deepEqual(ids(onlyDocs), [doc.id]);
  assert.equal((await call('GET', '/api/queries?kind=NOPE', actors.admin.token)).status, 400);

  // answering flips whose turn it is
  await ok(reply(actors.owner.token, doc.id, 'Here you go'), 201, 'answer');
  const after = await ok(call('GET', `/api/queries?awaiting=me&applicationId=${app.id}`, actors.owner.token), 200, 'owner inbox after');
  assert.deepEqual(after, [], 'nothing left for the owner');
  assert.ok(ids(await ok(call('GET', `/api/queries?awaiting=me&applicationId=${app.id}`, actors.lmo.token), 200, 'officer after')).includes(doc.id));

  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.deepEqual(await ok(call('GET', `/api/queries?applicationId=${app.id}`, stranger.token), 200, 'stranger'), []);
});

test('closing, reopening and the history of a thread', async () => {
  const app = await assigned();
  const q = await ok(call('POST', '/api/queries', actors.lmo.token, { applicationId: app.id, subject: 'History', message: 'First' }), 201, 'open');
  await ok(reply(actors.owner.token, q.id, 'Second'), 201, 'reply');
  await ok(call('PATCH', `/api/queries/${q.id}/close`, actors.lmo.token), 200, 'close');
  assert.equal((await reply(actors.owner.token, q.id, 'too late')).status, 409, 'closed threads take no replies');

  assert.equal((await call('PATCH', `/api/queries/${q.id}/reopen`, actors.owner.token)).status, 403, 'the applicant cannot reopen');
  const stranger = await h.createUser('LMO');
  assert.equal((await call('PATCH', `/api/queries/${q.id}/reopen`, stranger.token)).status, 403, 'nor can an unrelated officer');
  const reopened = await ok(call('PATCH', `/api/queries/${q.id}/reopen`, actors.lmo.token), 200, 'reopen');
  assert.equal(reopened.status, 'OPEN');
  assert.equal(reopened.closed_at, null);
  assert.equal((await call('PATCH', `/api/queries/${q.id}/reopen`, actors.lmo.token)).status, 200, 'reopening an open thread is harmless');
  await ok(reply(actors.owner.token, q.id, 'Now it works'), 201, 'reply after reopen');

  const { rows } = await h.pool.query("SELECT 1 FROM notifications WHERE recipient_id = $1 AND title LIKE 'Query reopened%'", [actors.owner.id]);
  assert.equal(rows.length, 1, 'the applicant is told once');

  const thread = await ok(call('GET', `/api/queries/${q.id}`, actors.owner.token), 200, 'thread');
  assert.deepEqual(thread.history.map((e) => e.action), ['QUERY_OPENED', 'QUERY_REPLIED', 'QUERY_CLOSED', 'QUERY_REOPENED', 'QUERY_REPLIED']);
  assert.ok(thread.history.every((e) => e.actor_name && e.occurred_at));
  assert.equal(thread.status, 'OPEN');
});

// ---------------------------------------------------------------------------
// who may ask, who is told, and who may resolve
// ---------------------------------------------------------------------------

test('applicants ask, reply, attach and track; they can never resolve or reopen', async () => {
  const { application } = await newApplication(actors); // nobody assigned yet
  const open = await ok(call('POST', '/api/queries', actors.owner.token, { applicationId: application.id, subject: 'When will you visit?', message: 'Please give a date' }), 201, 'applicant opens');
  assert.equal(open.raised_by_id, actors.owner.id);

  // with no officer assigned, the administrators are told so the question is not left unseen
  const adminNotes = await h.pool.query("SELECT 1 FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND type = 'QUERY_MESSAGE'", [actors.admin.id, application.id]);
  assert.equal(adminNotes.rowCount, 1);
  const adminList = await ok(call('GET', `/api/queries?applicationId=${application.id}`, actors.admin.token), 200, 'admin list');
  assert.deepEqual(adminList.map((q) => q.id), [open.id], 'visible to administrators');
  assert.equal(adminList[0].can_close, true);

  // the applicant tracks the status and whose turn it is, and can add a file to a reply
  const mine = await ok(call('GET', `/api/queries/${open.id}`, actors.owner.token), 200, 'applicant thread');
  assert.equal(mine.status, 'OPEN');
  assert.equal(mine.awaiting, 'DEPARTMENT');
  assert.equal(mine.can_close, false, 'the opener is not allowed to resolve');
  const withFile = await reply(actors.owner.token, open.id, 'Photo attached', { bytes: png, type: 'image/png', name: 'shop.png' });
  assert.equal(withFile.status, 201, JSON.stringify(withFile.body));

  // not even the person who opened the thread may close or reopen it
  const closeTry = await call('PATCH', `/api/queries/${open.id}/close`, actors.owner.token);
  assert.equal(closeTry.status, 403);
  assert.match(closeTry.body.message, /administrator or the officer assigned/);
  assert.equal((await call('GET', `/api/queries/${open.id}`, actors.owner.token)).body.data.status, 'OPEN', 'still open');

  await ok(call('PATCH', `/api/queries/${open.id}/close`, actors.admin.token), 200, 'admin resolves');
  const closed = await ok(call('GET', `/api/queries/${open.id}`, actors.owner.token), 200, 'closed view');
  assert.equal(closed.status, 'CLOSED');
  assert.equal(closed.awaiting, null);
  assert.equal((await reply(actors.owner.token, open.id, 'one more thing')).status, 409, 'closed threads take no replies');
  assert.equal((await call('PATCH', `/api/queries/${open.id}/reopen`, actors.owner.token)).status, 403, 'applicants cannot reopen');
});

test('a query reaches the assigned officer; only that officer or an administrator can resolve it', async () => {
  const { application } = await newApplication(actors);
  const assignment = await assignTo(actors, application.id, actors.lmo);
  const q = await ok(call('POST', '/api/queries', actors.owner.token, { applicationId: application.id, subject: 'Calibration weights', message: 'Which weights will you use?' }), 201, 'open');

  const lmoNotes = await h.pool.query("SELECT title FROM notifications WHERE recipient_id = $1 AND related_application_id = $2 AND type = 'QUERY_MESSAGE'", [actors.lmo.id, application.id]);
  assert.equal(lmoNotes.rowCount, 1, 'the assigned officer is told');
  const adminNotes = await h.pool.query("SELECT 1 FROM notifications WHERE recipient_id = $1 AND related_application_id = $2", [actors.admin.id, application.id]);
  assert.equal(adminNotes.rowCount, 0, 'administrators are not spammed when an officer is assigned (they can still see everything)');
  assert.ok((await ok(call('GET', `/api/queries?awaiting=me&applicationId=${application.id}`, actors.lmo.token), 200, 'officer inbox')).some((t) => t.id === q.id));
  assert.ok((await ok(call('GET', `/api/queries?applicationId=${application.id}`, actors.admin.token), 200, 'admin sees it')).some((t) => t.id === q.id));

  // an officer who is not assigned sees nothing and cannot touch it
  const outsider = await h.createUser('LMO');
  assert.equal((await call('GET', `/api/queries/${q.id}`, outsider.token)).status, 403);
  assert.equal((await call('PATCH', `/api/queries/${q.id}/close`, outsider.token)).status, 403);
  assert.equal((await reply(outsider.token, q.id, 'hello')).status, 403);
  assert.deepEqual(await ok(call('GET', `/api/queries?applicationId=${application.id}`, outsider.token), 200, 'outsider list'), []);

  const view = await ok(call('GET', `/api/queries/${q.id}`, actors.lmo.token), 200, 'officer view');
  assert.equal(view.can_close, true);
  await ok(call('PATCH', `/api/queries/${q.id}/close`, actors.lmo.token), 200, 'assigned officer resolves');
  assert.equal((await call('PATCH', `/api/queries/${q.id}/reopen`, actors.owner.token)).status, 403);
  await ok(call('PATCH', `/api/queries/${q.id}/reopen`, actors.lmo.token), 200, 'assigned officer reopens');

  // an officer who declines the assignment loses access and cannot resolve any more
  const declined = await call('PATCH', `/api/assignments/${assignment.id}/status`, actors.lmo.token, { status: 'DECLINED' });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  assert.equal((await call('GET', `/api/queries/${q.id}`, actors.lmo.token)).status, 403, 'a declined officer no longer sees the thread');
  assert.equal((await call('PATCH', `/api/queries/${q.id}/close`, actors.lmo.token)).status, 403);
  await ok(call('PATCH', `/api/queries/${q.id}/close`, actors.admin.token), 200, 'admin still can');
});
