// Command HQ: admin-only overview, map, drill-down lists and evidence packs / reports.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const ocr = require('../src/modules/nameplate/ocrEngine');
const { createActors, runVerification, newApplication, assignTo, ok } = require('./workflow');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let actors;
const data = {}; // records created in before()

const call = (method, path, token, body) => h.call(method, path, { token, body });
const get = (path, token = actors.admin.token) => call('GET', path, token);

async function upload(path, token, fields, name, type) {
  const form = new FormData();
  form.append('file', new Blob([png], { type }), name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(`${await h.start()}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test.before(async () => {
  await h.start();
  actors = await createActors();
  ocr.setEngine(async () => ({ text: 'SERIAL NO: NOT-THE-REGISTERED-ONE', confidence: 90, engine: 'fake-ocr 1.0' }));

  // 1. a PASS with a certificate, an inspection photo, a nameplate check and a location on the map
  const a = await runVerification(actors);
  data.cert = await ok(call('POST', '/api/certificates', actors.admin.token, { verificationId: a.verification.id }), 201, 'issue');
  data.a = a;
  const photo = await upload('/api/attachments', actors.lmo.token, { category: 'INSPECTION_EVIDENCE', verificationId: a.verification.id, evidenceKind: 'SEAL' }, 'seal.png', 'image/png');
  assert.equal(photo.status, 201, JSON.stringify(photo.body));
  data.photo = photo.body.data;
  const plate = await upload(`/api/nameplate/instruments/${a.instrument.id}`, actors.owner.token, {}, 'plate.png', 'image/png');
  assert.equal(plate.status, 201, JSON.stringify(plate.body));
  await ok(call('PATCH', `/api/instruments/${a.instrument.id}`, actors.owner.token, { locationLat: 18.5204, locationLng: 73.8567 }), 200, 'locate');

  // 2. a FAIL
  data.failed = await runVerification(actors, { decision: 'FAIL' });

  // 3. a revoked certificate
  const c = await runVerification(actors);
  data.revoked = await ok(call('POST', '/api/certificates', actors.admin.token, { verificationId: c.verification.id }), 201, 'issue 3');
  await ok(call('PATCH', `/api/certificates/${data.revoked.id}/status`, actors.admin.token, { status: 'REVOKED', reason: 'Seal found broken at spot check' }), 200, 'revoke');

  // 4. an application nobody is assigned to, with a question from the applicant
  data.unassigned = (await newApplication(actors)).application;
  data.query = await ok(call('POST', '/api/queries', actors.owner.token, { applicationId: data.unassigned.id, subject: 'When?', message: 'Date please' }), 201, 'query');

  // 5. an enforcement case with coordinates
  data.case = await ok(call('POST', '/api/enforcement', actors.admin.token, {
    source: 'SPOT_CHECK', offenceType: 'UNSTAMPED_INSTRUMENT', description: 'Scale without a stamp', subjectName: `Trader ${h.unique('t')}`, latitude: 19.0, longitude: 73.0,
  }), 201, 'case');
});
test.after(async () => {
  ocr.setEngine(null);
  await ocr.shutdown();
  await h.stop();
});

test('every Command HQ route is for administrators only', async () => {
  const routes = ['/api/hq/overview', '/api/hq/map', '/api/hq/drill/applications-open', `/api/hq/evidence/certificates/${data.cert.id}`, `/api/hq/evidence/enforcement/${data.case.id}`, '/api/hq/evidence/certificates.csv'];
  for (const route of routes) {
    assert.equal((await h.call('GET', route, {})).status, 401, `anonymous ${route}`);
    for (const who of ['owner', 'lmo']) assert.equal((await get(route, actors[who].token)).status, 403, `${who} ${route}`);
    const gatc = await h.createUser('GATC');
    assert.equal((await get(route, gatc.token)).status, 403, `gatc ${route}`);
    assert.equal((await get(route)).status, 200, `admin ${route}`);
  }
});

test('overview: the tiles match the database and every tile has a drill-down with the same total', async () => {
  const view = await ok(get('/api/hq/overview'), 200, 'overview');
  const count = async (sql) => (await h.pool.query(sql)).rows[0].n;

  assert.equal(view.tiles['certificates-revoked'], await count("SELECT count(*)::int n FROM verification_certificates WHERE status = 'REVOKED'"));
  assert.equal(view.tiles['certificates-active'], await count("SELECT count(*)::int n FROM verification_certificates WHERE status = 'ACTIVE' AND valid_until >= CURRENT_DATE"));
  assert.equal(view.tiles['enforcement-open'], await count("SELECT count(*)::int n FROM enforcement_cases WHERE status IN ('OPEN','NOTICE_ISSUED')"));
  assert.equal(view.tiles['nameplate-pending'], await count("SELECT count(*)::int n FROM nameplate_checks WHERE status = 'PENDING_REVIEW'"));
  assert.ok(view.tiles['applications-unassigned'] >= 1 && view.tiles['queries-awaiting-department'] >= 1 && view.tiles['verifications-failed'] >= 1);
  assert.ok(view.tiles.instruments_on_map >= 1);

  // a tile and its list can never disagree
  for (const m of view.metrics) {
    if (view.tiles[m.id] === undefined) continue;
    const list = await ok(get(`/api/hq/drill/${m.id}?limit=1`), 200, m.id);
    assert.equal(list.total, view.tiles[m.id], `${m.id}: tile ${view.tiles[m.id]} vs list ${list.total}`);
  }
  assert.ok(Array.isArray(view.monthlyTrends) && Array.isArray(view.byDivision) && Array.isArray(view.officerWorkload));
  assert.ok(view.enforcement.totals && view.pendency);
  assert.ok(view.attention.length >= 4 && view.attention.every((a) => a.rows.length <= 5));
  assert.ok(view.instrumentStates);
});

test('drill-down: records with their link, status, time and responsible person; pagination; filters; unknown metrics', async () => {
  const revoked = await ok(get('/api/hq/drill/certificates-revoked'), 200, 'revoked');
  const row = revoked.rows.find((r) => r.id === data.revoked.id);
  assert.ok(row, 'the revoked certificate is listed');
  assert.equal(row.reference, data.revoked.certificate_number);
  assert.equal(row.link, `/certificates/${data.revoked.id}`);
  assert.equal(row.entity, 'certificate');
  assert.equal(row.responsible_id, actors.admin.id, 'responsible = who revoked it');
  assert.ok(row.at);

  const unassigned = await ok(get('/api/hq/drill/applications-unassigned'), 200, 'unassigned');
  const app = unassigned.rows.find((r) => r.id === data.unassigned.id);
  assert.equal(app.responsible, 'Unassigned');
  assert.equal(app.link, `/applications/${data.unassigned.id}`);
  const byDivision = await ok(get('/api/hq/drill/applications-unassigned?division=PUNE'), 200, 'pune');
  assert.ok(byDivision.rows.some((r) => r.id === data.unassigned.id));
  assert.equal((await ok(get('/api/hq/drill/applications-unassigned?division=NOWHERE'), 200, 'nowhere')).total, 0);

  const failed = await ok(get('/api/hq/drill/verifications-failed'), 200, 'failed');
  assert.ok(failed.rows.some((r) => r.id === data.failed.verification.id && r.responsible_id === actors.lmo.id && r.status === 'FAIL'));
  const queries = await ok(get('/api/hq/drill/queries-awaiting-department'), 200, 'queries');
  assert.ok(queries.rows.some((r) => r.id === data.query.id && r.responsible_id === actors.owner.id));
  const cases = await ok(get('/api/hq/drill/enforcement-open'), 200, 'cases');
  assert.ok(cases.rows.some((r) => r.id === data.case.id));
  assert.ok((await ok(get('/api/hq/drill/nameplate-pending'), 200, 'plates')).rows.length >= 1);

  // pagination is stable and bounded
  const all = await ok(get('/api/hq/drill/certificates-active?limit=100'), 200, 'active');
  assert.ok(all.total >= 1);
  const one = await ok(get('/api/hq/drill/applications-open?limit=1'), 200, 'page 1');
  const two = await ok(get('/api/hq/drill/applications-open?limit=1&offset=1'), 200, 'page 2');
  assert.equal(one.rows.length, 1);
  if (one.total > 1) assert.notEqual(one.rows[0].id, two.rows[0].id);
  assert.equal((await ok(get('/api/hq/drill/applications-open?limit=9999'), 200, 'cap')).limit, 100, 'limit is capped');
  assert.equal((await get('/api/hq/drill/not-a-metric')).status, 404);
});

test('map: instruments with coordinates are coloured by state; open cases appear; filter and bad input', async () => {
  const map = await ok(get('/api/hq/map'), 200, 'map');
  const point = map.instruments.find((p) => p.id === data.a.instrument.id);
  assert.ok(point, 'the located instrument is on the map');
  assert.equal(point.lat, 18.5204);
  assert.equal(point.lng, 73.8567);
  assert.equal(point.state, 'VALID');
  assert.equal(point.certificate_number, data.cert.certificate_number);
  assert.ok(map.instruments.every((p) => p.lat != null && p.lng != null), 'instruments without coordinates are never plotted');
  assert.ok(!map.instruments.some((p) => p.id === data.failed.instrument.id), 'no coordinates, no point');
  assert.ok(map.cases.some((c) => c.id === data.case.id && c.lat === 19));
  assert.equal(map.truncated, false);

  const valid = await ok(get('/api/hq/map?state=VALID'), 200, 'valid');
  assert.ok(valid.instruments.every((p) => p.state === 'VALID'));
  const overdue = await ok(get('/api/hq/map?state=OVERDUE'), 200, 'overdue');
  assert.ok(!overdue.instruments.some((p) => p.id === data.a.instrument.id));
  assert.equal((await get('/api/hq/map?state=BOGUS')).status, 400);
});

test('certificate evidence pack: IDs, fingerprints, readings, photos, people, audit trail; viewing it is audited', async () => {
  const before = (await h.pool.query("SELECT count(*)::int n FROM audit_log WHERE action = 'HQ_EVIDENCE_VIEWED'")).rows[0].n;
  const pack = await ok(get(`/api/hq/evidence/certificates/${data.cert.id}`), 200, 'pack');
  const stored = (await h.pool.query('SELECT record_sha256, pdf_sha256 FROM verification_certificates WHERE id = $1', [data.cert.id])).rows[0];

  assert.equal(pack.certificate.number, data.cert.certificate_number);
  assert.equal(pack.certificate.fingerprints.recordSha256, stored.record_sha256);
  assert.equal(pack.certificate.fingerprints.pdfSha256, stored.pdf_sha256);
  assert.match(pack.certificate.fingerprints.recordSha256, /^[0-9a-f]{64}$/);
  assert.equal(pack.certificate.fingerprints.recordMatches, true, 'the record fingerprint is recomputed and agrees');
  assert.equal(pack.certificate.issuedBy.id, actors.admin.id);
  assert.ok(pack.certificate.file_url.includes('sig='), 'the PDF link is signed');

  assert.equal(pack.instrument.id, data.a.instrument.id);
  assert.equal(pack.instrument.owner.id, actors.owner.id);
  assert.equal(pack.verification.id, data.a.verification.id);
  assert.equal(pack.verification.officer.id, actors.lmo.id);
  assert.equal(pack.verification.decision, 'PASS');
  assert.match(pack.verification.resultSha256, /^[0-9a-f]{64}$/);
  assert.equal(pack.verification.decidedBy.id, actors.lmo.id);
  assert.equal(pack.application.number, data.a.application.application_number);
  assert.ok(pack.readings.length >= 1 && pack.readings[0].result === 'PASS');

  assert.equal(pack.photos.length, 1);
  assert.equal(pack.photos[0].id, data.photo.id);
  assert.equal(pack.photos[0].kind, 'SEAL');
  assert.equal(pack.photos[0].sha256, data.photo.file_sha256);
  assert.equal(pack.photos[0].uploadedBy.id, actors.lmo.id);
  assert.ok(pack.photos[0].file_url.includes('sig='));
  assert.equal(pack.nameplateChecks.length, 1);
  assert.match(pack.nameplateChecks[0].sha256, /^[0-9a-f]{64}$/);

  const actions = pack.auditTrail.map((e) => e.action);
  assert.ok(actions.includes('CERTIFICATE_ISSUED'));
  assert.ok(pack.auditTrail.every((e) => /^[0-9a-f]{64}$/.test(e.hash)));

  assert.equal((await h.pool.query("SELECT count(*)::int n FROM audit_log WHERE action = 'HQ_EVIDENCE_VIEWED'")).rows[0].n, before + 1, 'who looked at the evidence is recorded');
  const entry = (await h.pool.query("SELECT actor_id, entity_id FROM audit_log WHERE action = 'HQ_EVIDENCE_VIEWED' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.equal(entry.actor_id, actors.admin.id);
  assert.equal(entry.entity_id, data.cert.id);

  // the revoked one shows who revoked it and why
  const revoked = await ok(get(`/api/hq/evidence/certificates/${data.revoked.id}`), 200, 'revoked pack');
  assert.equal(revoked.certificate.revocation.by.id, actors.admin.id);
  assert.match(revoked.certificate.revocation.reason, /Seal found broken/);

  assert.equal((await get('/api/hq/evidence/certificates/not-an-id')).status, 404);
  assert.equal((await get('/api/hq/evidence/certificates/00000000-0000-4000-8000-000000000000')).status, 404);
});

test('a tampered certificate record is visible in its evidence pack', async () => {
  const run = await runVerification(actors);
  const cert = await ok(call('POST', '/api/certificates', actors.admin.token, { verificationId: run.verification.id }), 201, 'issue');
  await h.pool.query('ALTER TABLE verification_certificates DISABLE TRIGGER trg_protect_issued_certificate');
  try {
    await h.pool.query("UPDATE verification_certificates SET valid_until = valid_until + 365 WHERE id = $1", [cert.id]);
  } finally {
    await h.pool.query('ALTER TABLE verification_certificates ENABLE TRIGGER trg_protect_issued_certificate');
  }
  const pack = await ok(get(`/api/hq/evidence/certificates/${cert.id}`), 200, 'tampered');
  assert.equal(pack.certificate.fingerprints.recordMatches, false);
  assert.notEqual(pack.certificate.fingerprints.recordRecomputed, pack.certificate.fingerprints.recordSha256);
});

test('enforcement case evidence pack', async () => {
  const pack = await ok(get(`/api/hq/evidence/enforcement/${data.case.id}`), 200, 'case pack');
  assert.equal(pack.case.number, data.case.case_number);
  assert.equal(pack.case.detectedBy.id, actors.admin.id);
  assert.deepEqual(pack.case.gps, { lat: 19, lng: 73 });
  assert.ok(pack.events.length >= 1 && pack.events[0].by.id === actors.admin.id);
  assert.ok(pack.auditTrail.length >= 1);
  assert.equal((await get('/api/hq/evidence/enforcement/not-an-id')).status, 404);
});

test('evidence report (CSV): one row per certificate with IDs, fingerprints, photos and people; filters; audited', async () => {
  const res = await fetch(`${await h.start()}/api/hq/evidence/certificates.csv`, { headers: { authorization: `Bearer ${actors.admin.token}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /pramaan-evidence-.*\.csv/);
  const csv = await res.text();
  const [header, ...lines] = csv.replace(/^﻿/, '').trim().split('\r\n');
  for (const column of ['Certificate ID', 'Record fingerprint (SHA-256)', 'PDF fingerprint (SHA-256)', 'Photos (kind:ID:SHA-256)', 'Inspecting officer', 'Issued by', 'Result seal (SHA-256)']) {
    assert.ok(header.includes(column), column);
  }
  const mine = lines.find((l) => l.includes(data.cert.certificate_number));
  assert.ok(mine, 'the certificate is in the report');
  const stored = (await h.pool.query('SELECT record_sha256, pdf_sha256 FROM verification_certificates WHERE id = $1', [data.cert.id])).rows[0];
  assert.ok(mine.includes(stored.record_sha256) && mine.includes(stored.pdf_sha256));
  assert.ok(mine.includes(`SEAL:${data.photo.id}:${data.photo.file_sha256}`), 'photo reference with its fingerprint');
  assert.ok(mine.includes(data.cert.id) && mine.includes(actors.lmo.id));

  const revokedOnly = await (await fetch(`${await h.start()}/api/hq/evidence/certificates.csv?status=REVOKED`, { headers: { authorization: `Bearer ${actors.admin.token}` } })).text();
  assert.ok(revokedOnly.includes(data.revoked.certificate_number) && !revokedOnly.includes(data.cert.certificate_number));
  assert.equal((await get('/api/hq/evidence/certificates.csv?status=NOPE')).status, 400);
  assert.equal((await get('/api/hq/evidence/certificates.csv?from=2030-02-01&to=2030-01-01')).status, 400);
  assert.equal((await get('/api/hq/evidence/certificates.csv?from=yesterday')).status, 400);
  const empty = await (await fetch(`${await h.start()}/api/hq/evidence/certificates.csv?from=2001-01-01&to=2001-12-31`, { headers: { authorization: `Bearer ${actors.admin.token}` } })).text();
  assert.equal(empty.replace(/^﻿/, '').trim().split('\r\n').length, 1, 'header only');

  const logged = (await h.pool.query("SELECT details FROM audit_log WHERE action = 'HQ_EVIDENCE_EXPORTED' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.ok(logged, 'the export is audited');
  assert.equal(logged.details.rows, 0);
});

test('queries stay fast: the map and lists use indexes, not full scans of large tables', async () => {
  // The planner may prefer a scan on tiny test tables, so ask it to avoid sequential scans and check that the
  // partial indexes are the ones it picks.
  const plan = async (sql) => {
    const client = await h.pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      return (await client.query(`EXPLAIN ${sql}`)).rows.map((r) => r['QUERY PLAN']).join('\n');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  };
  assert.match(await plan("SELECT id FROM instruments WHERE location_lat IS NOT NULL AND status NOT IN ('INACTIVE','DECOMMISSIONED')"), /idx_instruments_on_map/);
  assert.match(await plan("SELECT 1 FROM verification_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW','SCHEDULED') ORDER BY submitted_at"), /idx_applications_open_submitted|idx_verification_applications_pending/);
  assert.match(await plan("SELECT 1 FROM verification_results WHERE decision = 'FAIL' AND result_date >= now() - interval '30 days'"), /idx_verification_results_fail_recent/);

  // and the whole overview answers in a fraction of a second on this data
  const started = Date.now();
  await ok(get('/api/hq/overview'), 200, 'timed');
  assert.ok(Date.now() - started < 3000, `overview took ${Date.now() - started} ms`);
});
