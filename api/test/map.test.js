// Checkpoint 1: map-based location. Coordinates are chosen on a map (or left empty) and
// never invented. The pure rules live in web/src/utils/coordinates.ts and are tested here
// (Node strips the types); the picker itself is checked in a browser separately.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers');
const { createActors, ok } = require('./workflow');

let actors;
let types;
let geo;

test.before(async () => {
  await h.start();
  actors = await createActors();
  types = await ok(h.call('GET', '/api/instruments/types', { token: actors.owner.token }), 200, 'types');
  geo = await import('../../web/src/utils/coordinates.ts');
});
test.after(async () => {
  await h.stop();
});

const create = (body) =>
  h.call('POST', '/api/instruments', {
    token: actors.owner.token,
    body: { instrumentTypeId: types[0].id, instrumentName: 'Map Scale', serialNumber: h.unique('GEO'), ...body },
  });
const row = async (id) => (await h.pool.query('SELECT location_lat, location_lng FROM instruments WHERE id = $1', [id])).rows[0];

test('coordinate rules: both or neither, numbers in range, rounded to 6 places', () => {
  const v = geo.validateLatLngText;
  assert.deepEqual(v('', ''), { ok: true, value: null, error: null });
  assert.deepEqual(v('  ', ' '), { ok: true, value: null, error: null });
  assert.equal(v('18.5204', '').ok, false);
  assert.match(v('', '73.8').error, /both/);
  assert.match(v('abc', '73.8').error, /numbers/);
  assert.match(v('91', '73.8').error, /Latitude/);
  assert.match(v('-91', '73.8').error, /Latitude/);
  assert.match(v('18.5', '181').error, /Longitude/);
  assert.deepEqual(v('18.5204567891', '73.8567'), { ok: true, value: { lat: 18.520457, lng: 73.8567 }, error: null });
  assert.equal(v('90', '180').ok, true, 'the limits themselves are valid');
  assert.equal(v('NaN', '1').ok, false);
  assert.equal(v('Infinity', '1').ok, false);
  assert.equal(geo.formatCoordinate(18.52), '18.520000');
  assert.equal(geo.round6(1.00000049), 1);
});

test('India warning is only a warning, and the old invented default is recognised', () => {
  assert.equal(geo.isInIndia({ lat: 18.52, lng: 73.85 }), true);
  assert.equal(geo.isInIndia({ lat: 6.75, lng: 93.9 }), true, 'Andaman and Nicobar');
  assert.equal(geo.isInIndia({ lat: 51.5, lng: -0.12 }), false);
  assert.equal(geo.isInIndia({ lat: 0, lng: 0 }), false);

  assert.equal(geo.isFormerDefault(19.076, 72.998), true);
  assert.equal(geo.isFormerDefault('19.0760', '72.9980'), true, 'numeric strings from the database');
  assert.equal(geo.isFormerDefault(19.0761, 72.998), true, 'within the tolerance');
  assert.equal(geo.isFormerDefault(19.08, 72.998), false);
  assert.equal(geo.isFormerDefault(null, null), false);
  assert.equal(geo.isFormerDefault(undefined, 72.998), false);
  assert.deepEqual(geo.DEFAULT_VIEW.center, { lat: 22.5, lng: 79 });
});

test('API: an instrument registered without a location stores none (no invented default)', async () => {
  const res = await create({});
  assert.equal(res.status, 201, res.text);
  assert.deepEqual(await row(res.body.data.id), { location_lat: null, location_lng: null });
  assert.equal(res.body.data.location_lat, null);
});

test('API: a picked location is stored; incomplete or impossible points are refused', async () => {
  const good = await create({ locationLat: 18.520457, locationLng: 73.856744 });
  assert.equal(good.status, 201, good.text);
  const stored = await row(good.body.data.id);
  assert.equal(Number(stored.location_lat), 18.520457);
  assert.equal(Number(stored.location_lng), 73.856744);

  assert.equal((await create({ locationLat: 18.5 })).status, 400, 'latitude alone');
  assert.equal((await create({ locationLng: 73.8 })).status, 400, 'longitude alone');
  assert.equal((await create({ locationLat: 95, locationLng: 10 })).status, 400);
  assert.equal((await create({ locationLat: 10, locationLng: 200 })).status, 400);
  assert.equal((await create({ locationLat: '18.5', locationLng: '73.8' })).status, 400, 'text instead of numbers');
  // "no location" is expressed by leaving the fields out (the existing body validator accepts numbers only)
  assert.equal((await create({ locationLat: null, locationLng: null })).status, 400, 'explicit nulls are not numbers');
  const before = (await h.pool.query('SELECT count(*)::int n FROM instruments')).rows[0].n;
  await create({ locationLat: 95, locationLng: 10 });
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM instruments')).rows[0].n, before, 'refused requests save nothing');
});

test('API: the location can be corrected or cleared later, but never left half-set', async () => {
  const inst = (await create({ locationLat: 19.076, locationLng: 72.998 })).body.data; // the old invented default
  const patch = (body) => h.call('PATCH', `/api/instruments/${inst.id}`, { token: actors.owner.token, body });

  assert.equal((await patch({ locationLat: null })).status, 400, 'clearing only one coordinate would leave a half-set point');
  const fixed = await ok(patch({ locationLat: 18.520457, locationLng: 73.856744 }), 200, 'correct');
  assert.equal(Number(fixed.location_lat), 18.520457);
  assert.equal(geo.isFormerDefault(fixed.location_lat, fixed.location_lng), false);

  const cleared = await ok(patch({ locationLat: null, locationLng: null }), 200, 'clear');
  assert.equal(cleared.location_lat, null);
  assert.equal(cleared.location_lng, null);
  assert.equal((await patch({ locationLat: 18.5 })).status, 400, 'a lone latitude when no location is stored');
  assert.equal((await patch({ locationLng: 73.8 })).status, 400, 'a lone longitude when no location is stored');
  assert.equal((await patch({ locationLat: 95, locationLng: 10 })).status, 400);

  // with both stored, changing one of them is a legitimate partial update and the point stays complete
  await ok(patch({ locationLat: 18.5, locationLng: 73.8 }), 200, 'set again');
  const nudged = await ok(patch({ locationLat: 18.6 }), 200, 'nudge latitude only');
  assert.equal(Number(nudged.location_lat), 18.6);
  assert.equal(Number(nudged.location_lng), 73.8);

  const stranger = await h.createUser('INSTRUMENT_OWNER');
  assert.equal((await h.call('PATCH', `/api/instruments/${inst.id}`, { token: stranger.token, body: { locationLat: 1, locationLng: 1 } })).status, 403);
});
