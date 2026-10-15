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
  dir = mkdtempSync(join(tmpdir(), 'kd-search-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const screens = (kitchen = {}) => ({
  defaultScreen: 'kitchen',
  screens: { kitchen: { title: 'Kitchen', timezone: 'UTC', ...kitchen } },
});

test('the search bar is off by default and sits below the calendar', () => {
  const cfg = validateConfig(screens());
  assert.equal(cfg.screens.kitchen.search, false);
  assert.equal(cfg.screens.kitchen.searchPosition, 'below');
});

test('older saved values still load: "off" is off, "google" and "duckduckgo" are on', () => {
  assert.equal(validateConfig(screens({ search: 'off' })).screens.kitchen.search, false);
  assert.equal(validateConfig(screens({ search: 'google' })).screens.kitchen.search, true);
  assert.equal(validateConfig(screens({ search: 'duckduckgo' })).screens.kitchen.search, true);
  assert.equal(validateConfig(screens({ search: true })).screens.kitchen.search, true);
  assert.throws(() => validateConfig(screens({ search: 'bing' })), /search/);
  assert.throws(() => validateConfig(screens({ searchPosition: 'sideways' })), /searchPosition/);
});

test('the dashboard switches the search bar on and chooses its place', async () => {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    iconsDir: join(dir, 'icons'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: 'pw',
  };
  const services = createServices({ config: validateConfig(screens({ mode: 'interactive' })), settings });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const patch = (payload) => app.inject({ method: 'PATCH', url: '/api/admin/screens/kitchen', headers: { cookie }, payload });

  assert.equal((await app.inject('/api/screens/kitchen')).json().search, false);

  assert.equal((await patch({ search: true, searchPosition: 'above' })).statusCode, 200);
  const shown = (await app.inject('/api/screens/kitchen')).json();
  assert.equal(shown.search, true);
  assert.equal(shown.searchPosition, 'above');

  // The search engine choice is gone: only on/off and a position are accepted now.
  assert.equal((await patch({ search: 'duckduckgo' })).statusCode, 200); // old value still understood
  assert.equal((await patch({ search: 'bing' })).statusCode, 400);
  assert.equal((await patch({ searchPosition: 'left' })).statusCode, 400);
  await app.close();
});
