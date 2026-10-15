import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { pruneLinkIcons } from '../src/services/linkIcons.js';
import { buildApp } from '../src/app.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-links-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const baseConfig = () =>
  validateConfig({
    defaultScreen: 'kitchen',
    screens: {
      kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', mode: 'interactive' },
      hall: { title: 'Hall', timezone: 'UTC', mode: 'interactive' },
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
  const services = createServices({ config: baseConfig(), settings });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const send = (method, url, payload, headers = {}) =>
    app.inject({ method, url, payload, headers: { cookie, ...headers } });
  return { app, settings, send };
}

// Starts like a PNG; the server checks the first bytes, not the name.
const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const link = (n, over = {}) => ({ title: `Link ${n}`, url: `https://example.com/${n}`, icon: 'preset:globe', ...over });

test('links: up to six, web addresses only, no duplicates, known icons only', async () => {
  const { app, send } = await start();
  const save = (links) => send('PATCH', '/api/admin/screens/kitchen', { links });

  assert.equal((await save([link(1), link(2)])).statusCode, 200);
  assert.equal((await save([1, 2, 3, 4, 5, 6].map((n) => link(n)))).statusCode, 200);

  assert.equal((await save([1, 2, 3, 4, 5, 6, 7].map((n) => link(n)))).statusCode, 400); // seven
  assert.equal((await save([link(1, { url: 'javascript:alert(1)' })])).statusCode, 400);
  assert.equal((await save([link(1, { url: 'ftp://example.com' })])).statusCode, 400);
  assert.equal((await save([link(1, { url: 'not a url' })])).statusCode, 400);
  assert.equal((await save([link(1, { icon: 'preset:nope' })])).statusCode, 400);
  assert.equal((await save([link(1, { title: '' })])).statusCode, 400);

  const dup = await save([link(1), link(2, { url: 'https://example.com/1/' })]);
  assert.equal(dup.statusCode, 400);
  assert.match(dup.json().problems.join(' '), /already in the list/);

  // Nothing bad was kept: the last good list is still there.
  assert.equal((await app.inject('/api/screens/kitchen')).json().links.length, 6);
  await app.close();
});

test('each display has its own links and position', async () => {
  const { app, send } = await start();
  await send('PATCH', '/api/admin/screens/kitchen', { links: [link(1)], linksPosition: 'left' });
  await send('PATCH', '/api/admin/screens/hall', { links: [link(2), link(3)] });

  const kitchen = (await app.inject('/api/screens/kitchen')).json();
  const hall = (await app.inject('/api/screens/hall')).json();
  assert.deepEqual(kitchen.links.map((l) => l.url), ['https://example.com/1']);
  assert.deepEqual(hall.links.map((l) => l.url), ['https://example.com/2', 'https://example.com/3']);
  assert.equal(kitchen.linksPosition, 'left');
  assert.equal(hall.linksPosition, 'bottom'); // default

  // The same address is fine on two different displays.
  assert.equal((await send('PATCH', '/api/admin/screens/hall', { links: [link(1)] })).statusCode, 200);
  assert.equal((await send('PATCH', '/api/admin/screens/kitchen', { linksPosition: 'diagonal' })).statusCode, 400);
  await app.close();
});

test('the display page gets icons resolved: built-in by name, uploads by address', async () => {
  const { app, send } = await start();
  const up = await send('POST', '/api/admin/screens/kitchen/link-icon', fakePng, { 'content-type': 'image/png' });
  assert.equal(up.statusCode, 200);
  const { icon, url } = up.json();
  assert.match(icon, /^image:[a-z0-9]+-[a-f0-9]{6}\.png$/);

  await send('PATCH', '/api/admin/screens/kitchen', {
    links: [link(1, { icon: 'preset:mail' }), link(2, { icon }), ],
  });
  const { links } = (await app.inject('/api/screens/kitchen')).json();
  assert.deepEqual(links[0].icon, { preset: 'mail' });
  assert.deepEqual(links[1].icon, { imageUrl: url });

  // The picture is served, with the same access rule as the display.
  assert.equal((await app.inject(url)).statusCode, 200);
  const outside = await app.inject({ url, headers: { 'cf-connecting-ip': '203.0.113.9' } });
  assert.equal(outside.statusCode, 403);
  await app.close();
});

test('icon uploads: logged in, real images only, and only this display\'s pictures can be used', async () => {
  const { app, send } = await start();

  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/screens/kitchen/link-icon', payload: fakePng, headers: { 'content-type': 'image/png' } })).statusCode, 401);
  assert.equal((await send('POST', '/api/admin/screens/kitchen/link-icon', Buffer.from('plain text, not a picture at all'), { 'content-type': 'image/png' })).statusCode, 415);
  assert.equal((await send('POST', '/api/admin/screens/nope/link-icon', fakePng, { 'content-type': 'image/png' })).statusCode, 404);

  // A picture uploaded for one display cannot be attached to another's link.
  const forKitchen = (await send('POST', '/api/admin/screens/kitchen/link-icon', fakePng, { 'content-type': 'image/png' })).json().icon;
  const onHall = await send('PATCH', '/api/admin/screens/hall', { links: [link(1, { icon: forKitchen })] });
  assert.equal(onHall.statusCode, 400);
  assert.match(onHall.json().problems[0], /missing/);

  // Invented file names are refused too.
  assert.equal((await send('PATCH', '/api/admin/screens/hall', { links: [link(1, { icon: 'image:../../config.yaml' })] })).statusCode, 400);
  await app.close();
});

test('unused uploaded icons are cleaned up, but fresh uploads are kept for a while', async () => {
  const { settings } = await start();
  const folder = join(settings.iconsDir, 'kitchen');
  mkdirSync(folder, { recursive: true });
  const oldStamp = (Date.now() - 60 * 60_000).toString(36);
  const freshStamp = Date.now().toString(36);
  for (const name of [`${oldStamp}-aaaaaa.png`, `${oldStamp}-bbbbbb.png`, `${freshStamp}-cccccc.png`]) {
    writeFileSync(join(folder, name), fakePng);
  }

  await pruneLinkIcons(settings.iconsDir, 'kitchen', [{ icon: `image:${oldStamp}-aaaaaa.png` }]);

  assert.equal(existsSync(join(folder, `${oldStamp}-aaaaaa.png`)), true, 'still used');
  assert.equal(existsSync(join(folder, `${oldStamp}-bbbbbb.png`)), false, 'old and unused: removed');
  assert.equal(existsSync(join(folder, `${freshStamp}-cccccc.png`)), true, 'just uploaded: kept');
});

test('the dashboard\'s picture addresses carry the display token', async () => {
  const { app, send } = await start();
  const made = (await send('POST', '/api/admin/screens/kitchen/token')).json().token;

  const overview = (await send('GET', '/api/admin/overview')).json();
  const kitchen = overview.screens.find((s) => s.id === 'kitchen');
  assert.equal(kitchen.token, made);
  assert.deepEqual(kitchen.links, []);
  assert.equal(kitchen.linksPosition, 'bottom');
  await app.close();
});
