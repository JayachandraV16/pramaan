// Dashboard stats, chart endpoints, management summary, CSV export and
// attachment evidence metadata.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, runVerification, newApplication, ok } = require('./workflow');
const { toCsv, escapeCell } = require('../src/utils/csv');

let actors;
let issued; // { flow, cert } for actors.owner

test.before(async () => {
  await h.start();
  actors = await createActors();
  const flow = await runVerification(actors);
  const cert = await ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
    201,
    'issue'
  );
  // plus one open application so pendency is non-zero
  await newApplication(actors);
  issued = { flow, cert };
});
test.after(() => h.stop());

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('CSV writer quotes, guards against formula injection and keeps numbers numeric', () => {
  assert.equal(escapeCell('plain'), 'plain');
  assert.equal(escapeCell('a,b'), '"a,b"');
  assert.equal(escapeCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCell('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(escapeCell('+91 98765'), "'+91 98765");
  assert.equal(escapeCell('@cmd'), "'@cmd");
  assert.equal(escapeCell(-5), '-5');
  assert.equal(escapeCell(null), '');
  const csv = toCsv([['a', 'A'], ['b', 'B']], [{ a: 1, b: '=1+1' }]);
  assert.ok(csv.startsWith('﻿A,B\r\n'));
  assert.ok(csv.endsWith("1,'=1+1\r\n"));
});

test('dashboard stats (admin) match the data and keep the shape the web app expects', async () => {
  const res = await h.call('GET', '/api/dashboard/stats', { token: actors.admin.token });
  assert.equal(res.status, 200);
  const d = res.body.data;
  for (const key of ['totalInstruments', 'activeCertificates', 'pendingApplications', 'completedVerifications', 'passRatePercentage', 'recentActivity']) {
    assert.ok(key in d, key);
  }
  assert.ok(d.totalInstruments >= 2);
  assert.ok(d.activeCertificates >= 1);
  assert.ok(d.pendingApplications >= 1);
  assert.ok(d.completedVerifications >= 1);
  assert.ok(d.passRatePercentage > 0 && d.passRatePercentage <= 100);
  assert.ok(d.recentActivity.length > 0);
  assert.deepEqual(Object.keys(d.recentActivity[0]).sort(), ['description', 'id', 'status', 'timestamp', 'title', 'type']);
  assert.ok(d.awaitingAssignment >= 1);
  assert.equal(typeof d.applicationsByStatus, 'object');
});

test('dashboard stats are scoped: an owner sees only their own data', async () => {
  const mine = await h.call('GET', '/api/dashboard/stats', { token: actors.owner.token });
  assert.equal(mine.body.data.totalInstruments, 2);
  assert.equal(mine.body.data.activeCertificates, 1);

  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const theirs = await h.call('GET', '/api/dashboard/stats', { token: stranger.token });
  assert.equal(theirs.body.data.totalInstruments, 0);
  assert.equal(theirs.body.data.activeCertificates, 0);
  assert.equal(theirs.body.data.recentActivity.length, 0);

  // an officer sees assigned work only
  const officer = await h.createUser('LMO');
  const officerStats = await h.call('GET', '/api/dashboard/stats', { token: officer.token });
  assert.equal(officerStats.body.data.totalInstruments, 0);
  const assigned = await h.call('GET', '/api/dashboard/stats', { token: actors.lmo.token });
  assert.ok(assigned.body.data.completedVerifications >= 1);

  // public users have no dashboard
  const pub = await h.createUser('PUBLIC_USER');
  assert.equal((await h.call('GET', '/api/dashboard/stats', { token: pub.token })).status, 403);
  assert.equal((await h.call('GET', '/api/dashboard/stats')).status, 401);
});

test('category-wise approvals and monthly trends', async () => {
  const cat = await h.call('GET', '/api/reports/category-wise-approvals', { token: actors.admin.token });
  assert.equal(cat.status, 200);
  assert.ok(cat.body.data.length >= 1);
  const row = cat.body.data[0];
  assert.deepEqual(Object.keys(row).sort(), ['approvals', 'category', 'categoryLabel', 'fill']);
  assert.ok(row.approvals >= 1);

  const trends = await h.call('GET', '/api/reports/monthly-trends', { token: actors.admin.token });
  assert.equal(trends.body.data.length, 6);
  const current = trends.body.data[5];
  assert.deepEqual(Object.keys(current).sort(), ['approved', 'month', 'passRate', 'rejected', 'submitted']);
  assert.ok(current.submitted >= 1);
  assert.ok(current.approved >= 1);
  assert.ok(current.passRate > 0);
  assert.equal(trends.body.data[0].submitted, 0, 'oldest month has no data in a fresh database');
});

test('management summary: pendency, workload, divisions, forecast, scans (admin only)', async () => {
  // generate a scan so publicScans is non-zero
  await h.call('GET', `/api/qr-auth/${issued.cert.certificate_number}`);

  const res = await h.call('GET', '/api/reports/summary', { token: actors.admin.token });
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.ok(d.pendency.open >= 1);
  assert.equal(typeof d.pendency.ageBuckets['0-7 days'], 'number');
  assert.ok(d.byDivision.some((r) => r.division === 'PUNE' && r.applications >= 2));
  assert.ok(d.officerWorkload.some((r) => r.officer_id === actors.lmo.id && r.completed_assignments >= 1));
  assert.ok(d.expiryForecast.length >= 1);
  assert.ok(d.instrumentStates.VALID >= 1);
  assert.ok(d.publicScans.scans_30d >= 1);

  const owner = await h.call('GET', '/api/reports/summary', { token: actors.owner.token });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.data.publicScans, null, 'org-wide scan stats are admin-only');
  assert.equal(owner.body.data.officerWorkload.length >= 0, true);
});

test('CSV export: admin gets everything, owners only their own rows, bad input is refused', async () => {
  const admin = await h.call('GET', '/api/reports/export/certificates', { token: actors.admin.token });
  assert.equal(admin.status, 200);
  assert.match(admin.headers.get('content-type'), /text\/csv/);
  assert.match(admin.headers.get('content-disposition'), /attachment; filename="pramaan-certificates-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.ok(admin.text.startsWith('Certificate No.,Status,')); // fetch strips the BOM; the raw BOM is unit-tested above
  assert.ok(admin.text.includes(issued.cert.certificate_number));

  const withExt = await h.call('GET', '/api/reports/export/applications.csv?from=2020-01-01&to=2099-12-31', { token: actors.admin.token });
  assert.equal(withExt.status, 200);
  assert.ok(withExt.text.includes('LM/'));

  const own = await h.call('GET', '/api/reports/export/certificates', { token: actors.owner.token });
  assert.ok(own.text.includes(issued.cert.certificate_number));
  const stranger = await h.createUser('INSTRUMENT_OWNER');
  const none = await h.call('GET', '/api/reports/export/certificates', { token: stranger.token });
  assert.equal(none.status, 200);
  assert.equal(none.text.includes(issued.cert.certificate_number), false);
  assert.equal(none.text.trim().split(/\r?\n/).length, 1, 'header only');

  for (const dataset of ['verifications', 'instruments-due']) {
    assert.equal((await h.call('GET', `/api/reports/export/${dataset}`, { token: actors.admin.token })).status, 200, dataset);
  }
  assert.equal((await h.call('GET', '/api/reports/export/secrets', { token: actors.admin.token })).status, 404);
  assert.equal((await h.call('GET', '/api/reports/export/certificates?from=yesterday', { token: actors.admin.token })).status, 400);
  assert.equal((await h.call('GET', '/api/reports/export/certificates?from=2030-01-01&to=2020-01-01', { token: actors.admin.token })).status, 400);
  assert.equal((await h.call('GET', '/api/reports/export/certificates')).status, 401);
});

test('CSV export neutralises spreadsheet formulas coming from user data', async () => {
  const owner = await h.createUser('INSTRUMENT_OWNER', { fullName: '=HYPERLINK("http://evil.example")' });
  const { rows } = await h.pool.query('SELECT id FROM instrument_types LIMIT 1');
  const inst = await ok(
    h.call('POST', '/api/instruments', {
      token: owner.token,
      body: { instrumentTypeId: rows[0].id, instrumentName: '@malicious', serialNumber: h.unique('SN') },
    }),
    201,
    'instrument'
  );
  await ok(
    h.call('POST', '/api/applications', {
      token: owner.token,
      body: { instrumentId: inst.id, applicationType: 'VERIFICATION', division: 'PUNE' },
    }),
    201,
    'application'
  );
  const csv = await h.call('GET', '/api/reports/export/applications', { token: owner.token });
  assert.ok(csv.text.includes("'@malicious"));
  assert.ok(csv.text.includes(`"'=HYPERLINK(""http://evil.example"")"`));
  assert.equal(/(^|,)=HYPERLINK/m.test(csv.text), false);
});

test('evidence metadata (capture time + GPS) is stored with the upload and validated', async () => {
  const flow = await runVerification(actors);
  const base = await h.start();
  const upload = async (fields) => {
    const form = new FormData();
    form.append('file', new Blob([PNG]), 'seal.png');
    form.append('category', 'INSPECTION_EVIDENCE');
    form.append('verificationId', flow.verification.id);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const res = await fetch(`${base}/api/attachments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${actors.lmo.token}` },
      body: form,
    });
    return { status: res.status, body: await res.json() };
  };

  const capturedAt = new Date(Date.now() - 60 * 1000).toISOString();
  const good = await upload({ capturedAt, latitude: '18.520400', longitude: '73.856700' });
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.data.file_sha256.length, 64);
  assert.equal(Number(good.body.data.latitude), 18.5204);
  assert.equal(new Date(good.body.data.captured_at).toISOString(), capturedAt);

  assert.equal((await upload({ latitude: '18.5' })).status, 400, 'lat without lng');
  assert.equal((await upload({ latitude: '120', longitude: '10' })).status, 400, 'out of range');
  assert.equal((await upload({ latitude: 'abc', longitude: '10' })).status, 400);
  assert.equal((await upload({ capturedAt: 'not a date' })).status, 400);
  assert.equal((await upload({ capturedAt: new Date(Date.now() + 3600e3).toISOString() })).status, 400, 'future');
  assert.equal((await upload({})).status, 201, 'metadata is optional');
});
