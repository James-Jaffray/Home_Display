import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { buildApp } from '../src/app.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-displays-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const baseConfig = () =>
  validateConfig({
    defaultScreen: 'kitchen',
    calendars: { mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' } },
    screens: {
      kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'], fontScale: 1.2, rotate: 90 },
    },
  });

async function start() {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: 'pw',
  };
  const services = createServices({ config: baseConfig(), settings });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const send = (method, url, payload) => app.inject({ method, url, headers: { cookie }, payload });
  return { app, services, settings, send };
}

test('config.yaml cannot use a reserved display name', () => {
  const raw = baseConfig();
  raw.screens.admin = { title: 'Nope', timezone: 'UTC' };
  assert.throws(() => validateConfig(raw, {}), /reserved/);
});

test('creating a display: id from the title, own settings, own URL', async () => {
  const { app, send } = await start();

  const made = await send('POST', '/api/admin/screens', { title: "Parents' Kitchen", timezone: 'America/Toronto' });
  assert.equal(made.statusCode, 200);
  assert.equal(made.json().id, 'parents-kitchen');

  // It is a real display now, with defaults and no calendars.
  const screen = (await app.inject('/api/screens/parents-kitchen')).json();
  assert.equal(screen.title, "Parents' Kitchen");
  assert.equal(screen.timezone, 'America/Toronto');
  assert.equal(screen.layout, 'month-grid');
  assert.equal(screen.fontScale, 1);
  assert.equal(screen.rotate, 0);

  // Settings are independent per display.
  assert.equal((await send('PATCH', '/api/admin/screens/parents-kitchen', { fontScale: 1.5, rotate: 270 })).statusCode, 200);
  assert.equal((await app.inject('/api/screens/parents-kitchen')).json().fontScale, 1.5);
  assert.equal((await app.inject('/api/screens/kitchen')).json().fontScale, 1.2);
  assert.equal((await app.inject('/api/screens/kitchen')).json().rotate, 90);

  // The same title again gets a free id instead of an error.
  const again = await send('POST', '/api/admin/screens', { title: "Parents' Kitchen", timezone: 'UTC' });
  assert.equal(again.json().id, 'parents-kitchen-2');
  await app.close();
});

test('display names: reserved and duplicate ids are refused, bad timezone too', async () => {
  const { app, send } = await start();
  const create = (payload) => send('POST', '/api/admin/screens', payload);

  assert.equal((await create({ title: 'X', timezone: 'UTC', id: 'admin' })).statusCode, 400);
  assert.equal((await create({ title: 'X', timezone: 'UTC', id: 'kitchen' })).statusCode, 409);
  assert.equal((await create({ title: 'X', timezone: 'Mars/Olympus' })).statusCode, 400);
  assert.equal((await create({ title: '', timezone: 'UTC' })).statusCode, 400);

  // A title that would become a reserved id still works (it just gets another id).
  const odd = await create({ title: 'Admin', timezone: 'UTC' });
  assert.equal(odd.statusCode, 200);
  assert.notEqual(odd.json().id, 'admin');
  await app.close();
});

test('a new display can copy another display\'s look', async () => {
  const { app, send } = await start();
  const made = await send('POST', '/api/admin/screens', { title: 'Hall', timezone: 'UTC', copyLookFrom: 'kitchen' });
  assert.equal(made.statusCode, 200);
  const screen = (await app.inject('/api/screens/hall')).json();
  assert.equal(screen.fontScale, 1.2);
  assert.equal(screen.rotate, 90);
  assert.equal((await send('POST', '/api/admin/screens', { title: 'Hall 2', timezone: 'UTC', copyLookFrom: 'nope' })).statusCode, 404);
  await app.close();
});

test('timezone and title can be edited; only dashboard-made displays can be deleted', async () => {
  const { app, send } = await start();
  assert.equal((await send('PATCH', '/api/admin/screens/kitchen', { timezone: 'America/Vancouver', title: 'Main kitchen' })).statusCode, 200);
  const kitchen = (await app.inject('/api/screens/kitchen')).json();
  assert.equal(kitchen.timezone, 'America/Vancouver');
  assert.equal(kitchen.title, 'Main kitchen');
  assert.equal((await send('PATCH', '/api/admin/screens/kitchen', { timezone: 'Nowhere/Land' })).statusCode, 400);

  // config.yaml display: not deletable.
  assert.equal((await send('DELETE', '/api/admin/screens/kitchen')).statusCode, 400);

  await send('POST', '/api/admin/screens', { title: 'Temp', timezone: 'UTC' });
  const overview = (await send('GET', '/api/admin/overview')).json();
  const byId = Object.fromEntries(overview.screens.map((s) => [s.id, s]));
  assert.equal(byId.temp.removable, true);
  assert.equal(byId.kitchen.removable, false);

  assert.equal((await send('DELETE', '/api/admin/screens/temp')).statusCode, 200);
  assert.equal((await app.inject('/api/screens/temp')).statusCode, 404);
  await app.close();
});

test('displays survive a restart and /display routes work', async () => {
  const first = await start();
  await first.send('POST', '/api/admin/screens', { title: 'Garage', timezone: 'UTC' });
  await first.app.close();

  const settings = first.settings;
  const again = createServices({ config: baseConfig(), settings });
  await again.init();
  assert.ok(again.live.get().screens.garage);

  const app = await buildApp({ settings, services: again });
  assert.equal((await app.inject('/display')).headers.location, '/display/kitchen');
  assert.equal((await app.inject('/api/default-screen')).json().id, 'kitchen');
  assert.equal((await app.inject('/garage')).headers.location, '/display/garage');
  await app.close();
});
