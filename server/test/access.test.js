import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { buildApp } from '../src/app.js';
import { isPrivateAddress } from '../src/services/network.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-access-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('isPrivateAddress: home networks, loopback and VPN are private; the internet is not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.248', '172.16.0.1', '172.31.255.1', '100.64.0.1', '::1', 'fd12::1', 'fe80::1', '::ffff:192.168.1.5']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '100.128.0.1', '203.0.113.9', '2606:4700::1', '::ffff:8.8.8.8', 'not-an-ip', '']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

const baseConfig = (extraKitchen = {}) =>
  validateConfig({
    defaultScreen: 'kitchen',
    calendars: { mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' } },
    screens: {
      kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'], ...extraKitchen },
      hall: { title: 'Hall', timezone: 'UTC' },
    },
  });

async function start(config = baseConfig()) {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'https://display.example.com',
    google: { clientId: '', clientSecret: '' },
    adminPassword: 'pw',
  };
  const services = createServices({ config, settings });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  return { app, services, settings, cookie };
}

const fromInternet = { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9' };
const fromHomeProxy = { 'x-forwarded-for': '192.168.1.50' };

test('a display without a token: open at home, refused when the request comes from outside', async () => {
  const { app } = await start();
  const urls = ['/api/screens/kitchen', '/api/screens/kitchen/photos', '/api/screens/kitchen/events?weeks=4'];

  for (const url of urls) {
    assert.equal((await app.inject(url)).statusCode, 200, `local ${url}`);
    assert.equal((await app.inject({ url, headers: fromHomeProxy })).statusCode, 200, `home proxy ${url}`);
    const outside = await app.inject({ url, headers: fromInternet });
    assert.equal(outside.statusCode, 403, `outside ${url}`);
    assert.match(outside.json().error, /home network/);
  }
  // Photos obey the same rule.
  assert.equal((await app.inject({ url: '/photos/kitchen/a.jpg', headers: fromInternet })).statusCode, 403);
  await app.close();
});

test('a display with a token needs it everywhere, and nothing else changes', async () => {
  const { app } = await start(baseConfig({ token: 'x'.repeat(24) }));
  const token = 'x'.repeat(24);

  assert.equal((await app.inject('/api/screens/kitchen')).statusCode, 401); // even at home
  assert.equal((await app.inject('/api/screens/kitchen?k=wrong')).statusCode, 401);
  assert.equal((await app.inject(`/api/screens/kitchen?k=${token}`)).statusCode, 200);
  assert.equal((await app.inject({ url: `/api/screens/kitchen/events?weeks=4&k=${token}`, headers: fromInternet })).statusCode, 200);
  assert.equal((await app.inject({ url: `/photos/kitchen/a.jpg?k=${token}`, headers: fromInternet })).statusCode, 404); // allowed, just no such file

  // Another display is unaffected by kitchen's token.
  assert.equal((await app.inject('/api/screens/hall')).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/screens/hall', headers: fromInternet })).statusCode, 403);
  await app.close();
});

test('the page itself and the health check are not blocked', async () => {
  const { app } = await start();
  assert.equal((await app.inject({ url: '/api/health', headers: fromInternet })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/default-screen', headers: fromInternet })).statusCode, 200);
  assert.equal((await app.inject({ url: '/display', headers: fromInternet })).statusCode, 302);
  await app.close();
});

test('tokens are made by the dashboard, shown only to a logged-in owner, and can be removed', async () => {
  const { app, cookie, settings } = await start();

  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/screens/hall/token' })).statusCode, 401);

  const made = await app.inject({ method: 'POST', url: '/api/admin/screens/hall/token', headers: { cookie } });
  assert.equal(made.statusCode, 200);
  const { token } = made.json();
  assert.ok(token.length >= 24);

  // Now needed, at home too; works from outside with it.
  assert.equal((await app.inject('/api/screens/hall')).statusCode, 401);
  assert.equal((await app.inject({ url: `/api/screens/hall?k=${token}`, headers: fromInternet })).statusCode, 200);

  const overview = (await app.inject({ url: '/api/admin/overview', headers: { cookie } })).json();
  const hall = overview.screens.find((s) => s.id === 'hall');
  assert.equal(hall.token, token);
  assert.equal(hall.tokenSource, 'dashboard');
  assert.equal(overview.screens.find((s) => s.id === 'kitchen').token, null);

  // A new token replaces the old one.
  const second = (await app.inject({ method: 'POST', url: '/api/admin/screens/hall/token', headers: { cookie } })).json().token;
  assert.notEqual(second, token);
  assert.equal((await app.inject(`/api/screens/hall?k=${token}`)).statusCode, 401);

  // The browser cannot choose its own token through the settings endpoint.
  const sneaky = await app.inject({ method: 'PATCH', url: '/api/admin/screens/hall', headers: { cookie }, payload: { token: 'a'.repeat(30) } });
  assert.equal(sneaky.statusCode, 400);

  const gone = await app.inject({ method: 'DELETE', url: '/api/admin/screens/hall/token', headers: { cookie } });
  assert.equal(gone.json().stillRequired, false);
  assert.equal((await app.inject('/api/screens/hall')).statusCode, 200);

  if (process.platform !== 'win32') {
    assert.equal(statSync(join(settings.dataDir, 'settings.json')).mode & 0o077, 0, 'settings.json is owner-only');
  }
  await app.close();
});

test('a token written in config.yaml cannot be removed from the dashboard', async () => {
  const { app, cookie } = await start(baseConfig({ token: 'c'.repeat(24) }));
  const overview = (await app.inject({ url: '/api/admin/overview', headers: { cookie } })).json();
  assert.equal(overview.screens.find((s) => s.id === 'kitchen').tokenSource, 'config');

  const del = await app.inject({ method: 'DELETE', url: '/api/admin/screens/kitchen/token', headers: { cookie } });
  assert.equal(del.json().stillRequired, true);
  assert.equal((await app.inject('/api/screens/kitchen')).statusCode, 401);
  await app.close();
});
