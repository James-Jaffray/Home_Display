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
  dir = mkdtempSync(join(tmpdir(), 'kd-mode-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const config = validateConfig({
  defaultScreen: 'kitchen',
  screens: {
    kitchen: {
      title: 'Kitchen',
      timezone: 'UTC',
      search: true,
      links: [{ title: 'Mail', url: 'https://mail.example.com', icon: 'preset:mail' }],
    },
  },
});

async function start() {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    iconsDir: join(dir, 'icons'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: 'pw',
  };
  const services = createServices({ config, settings });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const patch = (payload) => app.inject({ method: 'PATCH', url: '/api/admin/screens/kitchen', headers: { cookie }, payload });
  return { app, cookie, patch };
}

test('a display is a kiosk unless you say otherwise', () => {
  assert.equal(config.screens.kitchen.mode, 'kiosk');
});

test('kiosk: the display page gets no links and no search bar, but they are kept', async () => {
  const { app, cookie } = await start();

  const page = (await app.inject('/api/screens/kitchen')).json();
  assert.equal(page.mode, 'kiosk');
  assert.deepEqual(page.links, []);
  assert.equal(page.search, false);

  // The dashboard still sees what is saved, so nothing is lost by being in kiosk mode.
  const overview = (await app.inject({ url: '/api/admin/overview', headers: { cookie } })).json();
  const kitchen = overview.screens.find((s) => s.id === 'kitchen');
  assert.equal(kitchen.mode, 'kiosk');
  assert.equal(kitchen.links.length, 1);
  assert.equal(kitchen.search, true);
  await app.close();
});

test('interactive: links and the search bar come back, exactly as saved', async () => {
  const { app, patch } = await start();
  assert.equal((await patch({ mode: 'interactive' })).statusCode, 200);

  const page = (await app.inject('/api/screens/kitchen')).json();
  assert.equal(page.mode, 'interactive');
  assert.equal(page.search, true);
  assert.deepEqual(page.links.map((l) => l.url), ['https://mail.example.com']);

  assert.equal((await patch({ mode: 'kiosk' })).statusCode, 200);
  assert.deepEqual((await app.inject('/api/screens/kitchen')).json().links, []);
  await app.close();
});

test('only the two modes are accepted', async () => {
  const { app, patch } = await start();
  assert.equal((await patch({ mode: 'party' })).statusCode, 400);
  assert.equal((await patch({ mode: 'interactive' })).statusCode, 200);
  await app.close();
});
