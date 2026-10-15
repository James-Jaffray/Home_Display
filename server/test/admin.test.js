import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { buildApp } from '../src/app.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-admin-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const baseConfig = () =>
  validateConfig({
    defaultScreen: 'kitchen',
    calendars: {
      mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' },
      work: { provider: 'google', account: 'james', calendarId: 'work@example.com', label: 'Work', color: '#445566' },
    },
    screens: { kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'] } },
  });

const settingsFor = (password = 'pw') => ({
  version: '0.0.0',
  photosDir: join(dir, 'photos'),
  dataDir: join(dir, 'data'),
  publicBaseUrl: 'http://localhost:8080',
  google: { clientId: 'id', clientSecret: 'secret' },
  adminPassword: password,
});

async function start(password) {
  const config = baseConfig();
  const settings = settingsFor(password);
  const services = createServices({ config, settings });
  await services.init();
  const app = await buildApp({ settings, services });
  return { app, services, settings, config };
}

async function login(app) {
  const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  return res.headers['set-cookie'].split(';')[0];
}

// Smallest thing that starts like a JPEG: the server checks the first bytes, not the name.
const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);

test('dashboard is disabled without ADMIN_PASSWORD', async () => {
  const { app } = await start('');
  assert.equal((await app.inject('/api/admin/overview')).statusCode, 503);
  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: '' } })).statusCode, 503);
  await app.close();
});

test('protected routes need a login; wrong passwords are locked out', async () => {
  const { app } = await start();
  assert.equal((await app.inject('/api/admin/overview')).statusCode, 401);
  assert.equal(
    (await app.inject({ method: 'PATCH', url: '/api/admin/screens/kitchen', payload: { fontScale: 1.2 } })).statusCode,
    401,
  );

  for (let i = 0; i < 5; i++) {
    const bad = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'nope' } });
    assert.ok([401, 429].includes(bad.statusCode));
  }
  // Even the right password is refused while locked out.
  const locked = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  assert.equal(locked.statusCode, 429);
  await app.close();
});

test('login sets a hardened cookie and unlocks the overview', async () => {
  const { app } = await start();
  const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  assert.equal(res.statusCode, 200);
  const cookie = res.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const overview = await app.inject({ url: '/api/admin/overview', headers: { cookie: cookie.split(';')[0] } });
  assert.equal(overview.statusCode, 200);
  const body = overview.json();
  assert.deepEqual(body.screens[0].calendars, ['mine']);
  assert.deepEqual(body.calendars.map((c) => c.id).sort(), ['mine', 'work']);
  assert.ok(!JSON.stringify(body).includes('secret'), 'no secrets in the overview');
  await app.close();
});

test('screen settings change the live display and survive a restart', async () => {
  const { app, services } = await start();
  const cookie = await login(app);
  const patch = await app.inject({
    method: 'PATCH',
    url: '/api/admin/screens/kitchen',
    headers: { cookie },
    payload: { fontScale: 1.3, layout: 'portrait-agenda', calendars: ['mine', 'work'], photoInterval: 30 },
  });
  assert.equal(patch.statusCode, 200);

  const screen = (await app.inject('/api/screens/kitchen')).json();
  assert.equal(screen.fontScale, 1.3);
  assert.equal(screen.layout, 'portrait-agenda');
  assert.equal(screen.photoInterval, 30);
  const events = (await app.inject('/api/screens/kitchen/events')).json();
  assert.deepEqual(events.calendars.map((c) => c.id), ['mine', 'work']);
  assert.ok(existsSync(join(dir, 'data', 'settings.json')));
  assert.equal(services.live.get().screens.kitchen.fontScale, 1.3);
  await app.close();

  // "Restart": a fresh set of services reads settings.json.
  const again = createServices({ config: baseConfig(), settings: settingsFor() });
  await again.init();
  assert.equal(again.live.get().screens.kitchen.fontScale, 1.3);
});

test('invalid changes are rejected and nothing is saved', async () => {
  const { app } = await start();
  const cookie = await login(app);
  const send = (payload) =>
    app.inject({ method: 'PATCH', url: '/api/admin/screens/kitchen', headers: { cookie }, payload });

  assert.equal((await send({ fontScale: 9 })).statusCode, 400);
  assert.equal((await send({ layout: 'sideways' })).statusCode, 400);
  assert.equal((await send({ bogus: true })).statusCode, 400);
  assert.equal((await send({ calendars: ['does-not-exist'] })).statusCode, 400);
  const missing = await app.inject({ method: 'PATCH', url: '/api/admin/screens/nope', headers: { cookie }, payload: {} });
  assert.equal(missing.statusCode, 404);

  assert.equal((await app.inject('/api/screens/kitchen')).json().fontScale, 1);
  assert.equal(existsSync(join(dir, 'data', 'settings.json')), false);
  await app.close();
});

test('cross-site writes are refused', async () => {
  const { app } = await start();
  const cookie = await login(app);
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/admin/screens/kitchen',
    headers: { cookie, origin: 'https://evil.example', host: 'localhost:8080' },
    payload: { fontScale: 1.1 },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test('photos: upload by content, list, serve, delete; non-images refused', async () => {
  const { app } = await start();
  const cookie = await login(app);
  const upload = (payload) =>
    app.inject({
      method: 'POST',
      url: '/api/admin/screens/kitchen/photos',
      headers: { cookie, 'content-type': 'image/jpeg' },
      payload,
    });

  assert.equal((await upload(Buffer.from('this is not an image at all, just text'))).statusCode, 415);

  const up = await upload(fakeJpeg);
  assert.equal(up.statusCode, 200);
  const { name, url } = up.json();
  assert.match(name, /^[a-z0-9]+-[a-f0-9]{6}\.jpg$/); // server-chosen name

  assert.deepEqual((await app.inject('/api/screens/kitchen/photos')).json().photos, [url]);
  assert.equal((await app.inject(url)).statusCode, 200);

  const del = (path, headers) => app.inject({ method: 'DELETE', url: path, headers });
  assert.equal((await del(`/api/admin/screens/kitchen/photos/${name}`)).statusCode, 401);
  assert.equal((await del('/api/admin/screens/kitchen/photos/..%2f..%2fconfig.yaml', { cookie })).statusCode, 404);
  assert.equal((await del(`/api/admin/screens/kitchen/photos/${name}`, { cookie })).statusCode, 200);
  assert.deepEqual((await app.inject('/api/screens/kitchen/photos')).json().photos, []);
  await app.close();
});

test('calendars added in the dashboard show up and can be removed; config.yaml ones cannot', async () => {
  const { app } = await start();
  const cookie = await login(app);

  const add = await app.inject({
    method: 'POST',
    url: '/api/admin/calendars',
    headers: { cookie },
    payload: {
      account: 'james',
      calendarId: 'family@group.calendar.google.com',
      label: 'Family',
      color: '#00aa88',
      screens: ['kitchen'],
    },
  });
  assert.equal(add.statusCode, 200);
  const { id } = add.json();
  const ids = async () => (await app.inject('/api/screens/kitchen/events')).json().calendars.map((c) => c.id);
  assert.deepEqual(await ids(), ['mine', id]);

  const noRemove = await app.inject({ method: 'DELETE', url: '/api/admin/calendars/mine', headers: { cookie } });
  assert.equal(noRemove.statusCode, 400);

  const rm = await app.inject({ method: 'DELETE', url: `/api/admin/calendars/${id}`, headers: { cookie } });
  assert.equal(rm.statusCode, 200);
  assert.deepEqual(await ids(), ['mine']);
  assert.equal(JSON.parse(readFileSync(join(dir, 'data', 'settings.json'), 'utf8')).calendars[id], undefined);
  await app.close();
});
