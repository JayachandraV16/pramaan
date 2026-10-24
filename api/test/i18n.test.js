// Phase 5: Hindi localisation of notifications and the certificate PDF.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, newApplication, runVerification, ok } = require('./workflow');
const i18n = require('../src/utils/i18n');
const { generateCertificatePDF } = require('../src/utils/certificateGenerator');

let actors;

test.before(async () => {
  await h.start();
  actors = await createActors();
});
test.after(async () => {
  await h.stop();
});

const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

test('users choose a language in their profile; invalid values are refused', async () => {
  const user = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await ok(h.call('GET', '/api/auth/me', { token: user.token }), 200, 'me')).preferred_language, 'en');

  const updated = await ok(h.call('PATCH', '/api/users/me', { token: user.token, body: { preferredLanguage: 'hi' } }), 200, 'set hi');
  assert.equal(updated.preferred_language, 'hi');
  assert.equal((await h.call('PATCH', '/api/users/me', { token: user.token, body: { preferredLanguage: 'fr' } })).status, 400);
  // the database enforces it too
  await assert.rejects(h.pool.query("UPDATE users SET preferred_language = 'xx' WHERE id = $1", [user.id]));
});

test('notifications are written in the recipient\'s language (English by default)', async () => {
  const hindiOwner = await h.createUser('INSTRUMENT_OWNER');
  const englishOwner = await h.createUser('INSTRUMENT_OWNER');
  await h.pool.query("UPDATE users SET preferred_language = 'hi' WHERE id = $1", [hindiOwner.id]);

  const body = (userId) => ({
    source: 'COMPLAINT', offenceType: 'SEAL_TAMPERING', description: 'Seal found broken', subjectUserId: userId,
  });
  await ok(h.call('POST', '/api/enforcement', { token: actors.lmo.token, body: body(hindiOwner.id) }), 201, 'case for hindi user');
  await ok(h.call('POST', '/api/enforcement', { token: actors.lmo.token, body: body(englishOwner.id) }), 201, 'case for english user');

  const hi = await ok(h.call('GET', '/api/notifications', { token: hindiOwner.token }), 200, 'hi notifications');
  const en = await ok(h.call('GET', '/api/notifications', { token: englishOwner.token }), 200, 'en notifications');
  assert.ok(hasDevanagari(hi[0].title) && hasDevanagari(hi[0].message), `expected Hindi, got: ${hi[0].title}`);
  assert.match(hi[0].message, /मुहर से छेड़छाड़/);
  assert.match(en[0].title, /^Enforcement case ENF-\d{4}-\d{6} registered$/);
  assert.match(en[0].message, /seal tampering/);
});

test('certificate-issued and verification-result notifications follow the language too', async () => {
  const owner = await h.createUser('INSTRUMENT_OWNER');
  await h.pool.query("UPDATE users SET preferred_language = 'hi' WHERE id = $1", [owner.id]);
  const flow = await runVerification({ ...actors, owner }, {});
  const certificate = await ok(
    h.call('POST', '/api/certificates', { token: actors.admin.token, body: { verificationId: flow.verification.id } }),
    201,
    'issue certificate'
  );
  const notes = await ok(h.call('GET', '/api/notifications', { token: owner.token }), 200, 'notifications');
  const issued = notes.find((n) => n.type === 'CERTIFICATE_ISSUED');
  assert.ok(issued, 'certificate issued notification exists');
  assert.ok(hasDevanagari(issued.title));
  assert.ok(issued.message.includes(certificate.certificate_number));
  const result = notes.find((n) => hasDevanagari(n.title) && n.type === 'APPLICATION_UPDATE');
  assert.ok(result, 'verification result notification in Hindi');
});

test('the catalogue renders every key in both languages and falls back safely', () => {
  const params = { number: 'C-1', instrument: 'Scale', days: 7, date: '2027-01-01', validUntil: '2027-01-01', reason: 'x', applicationNumber: 'A-1', challan: 'CH1', caseNumber: 'ENF-1', offence: 'OTHER', status: 'RESOLVED', flag: 'REPEAT', name: 'N', offences: 2 };
  const keys = ['certificate.expiring', 'certificate.expired', 'certificate.issued', 'certificate.revoked', 'assignment.new', 'payment.verified', 'verification.passed', 'verification.failed', 'enforcement.registered', 'enforcement.status', 'enforcement.offender'];
  for (const key of keys) {
    const en = i18n.render('en', key, params);
    const hi = i18n.render('hi', key, params);
    assert.ok(en.title && en.message && !hasDevanagari(en.title + en.message), `${key} english`);
    assert.ok(hasDevanagari(hi.title) && hasDevanagari(hi.message), `${key} hindi`);
  }
  assert.deepEqual(i18n.render('de', 'assignment.new', params), i18n.render('en', 'assignment.new', params));
  assert.throws(() => i18n.render('en', 'no.such.key', {}));
  assert.equal(i18n.render('en', 'certificate.expiring', { ...params, days: 1 }).message.includes('tomorrow'), true);
  assert.equal(i18n.render('hi', 'certificate.expiring', { ...params, days: 0 }).message.includes('आज'), true);
});

test('the certificate PDF has an English page and a Hindi page with the Devanagari font embedded', async () => {
  const cert = {
    certificate_number: 'CERT-2026-009999', instrument_name: 'Platform scale', manufacturer: 'Acme', model: 'A-1',
    serial_number: 'SN-1', valid_from: '2026-01-01', valid_until: '2027-01-01', issued_at: new Date(), record_sha256: 'a'.repeat(64),
  };
  const both = await generateCertificatePDF(cert, null);
  const text = both.toString('latin1');
  assert.equal((text.match(/\/Type \/Page\b/g) || []).length, 2);
  assert.match(text, /NotoSansDevanagari/);

  const englishOnly = await generateCertificatePDF(cert, null, { languages: ['en'] });
  assert.equal((englishOnly.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  assert.doesNotMatch(englishOnly.toString('latin1'), /NotoSansDevanagari/);
});
