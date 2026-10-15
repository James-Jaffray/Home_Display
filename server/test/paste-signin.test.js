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
  dir = mkdtempSync(join(tmpdir(), 'kd-paste-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const config = validateConfig({
  defaultScreen: 'kitchen',
  calendars: { mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' } },
  screens: { kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'] } },
});

const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const fakeGoogle = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/token')) {
    const code = new URLSearchParams(init.body).get('code');
    return json({ access_token: `at-${code}`, refresh_token: `rt-${code}`, expires_in: 3600 });
  }
  if (u.includes('/users/me/calendarList')) {
    return json({ items: [{ id: 'james@example.com', summary: 'James', primary: true, backgroundColor: '#336699' }] });
  }
  return json({ items: [] });
};

async function start() {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: 'id', clientSecret: 'secret' },
    adminPassword: 'pw',
  };
  const services = createServices({ config, settings, fetchImpl: fakeGoogle });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  return { app, services, cookie };
}

/** What the browser would have been sent to after Google sign-in, as an address. */
async function beginSignIn(app, cookie) {
  const start = await app.inject({ url: '/api/auth/google/start?account=james', headers: { cookie } });
  assert.equal(start.statusCode, 302);
  return new URL(start.headers.location).searchParams.get('state');
}

test('pasting the address from the browser completes the sign-in', async () => {
  const { app, services, cookie } = await start();
  const state = await beginSignIn(app, cookie);

  // This is the (unloadable) page the user lands on; they copy its address.
  const pasted = `http://localhost:8080/api/auth/google/callback?state=${state}&code=4%2Fabc&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly`;
  const res = await app.inject({ method: 'POST', url: '/api/auth/google/complete', headers: { cookie }, payload: { url: pasted } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().account, 'james');
  assert.equal(res.json().email, 'james@example.com');
  assert.equal(await services.tokens.get('james'), 'rt-4/abc');

  // The code works once.
  const again = await app.inject({ method: 'POST', url: '/api/auth/google/complete', headers: { cookie }, payload: { url: pasted } });
  assert.equal(again.statusCode, 400);
  await app.close();
});

test('pasting needs a login, a real state, and something that looks like an answer', async () => {
  const { app, cookie } = await start();
  const state = await beginSignIn(app, cookie);
  const post = (payload, headers = { cookie }) =>
    app.inject({ method: 'POST', url: '/api/auth/google/complete', headers, payload });

  assert.equal((await post({ url: `?state=${state}&code=x` }, {})).statusCode, 401);
  assert.equal((await post({ url: 'http://localhost:8080/api/auth/google/callback?state=forged&code=x' })).statusCode, 400);
  assert.equal((await post({ url: 'hello there' })).statusCode, 400);
  assert.equal((await post({})).statusCode, 400);

  // Just the part after "?" is fine too, and a denial from Google is reported, not stored.
  const denied = await post({ url: `?state=${state}&error=access_denied` });
  assert.equal(denied.statusCode, 400);
  await app.close();
});

test('the overview tells the dashboard where Google sends people back to', async () => {
  const { app, cookie } = await start();
  const overview = (await app.inject({ url: '/api/admin/overview', headers: { cookie } })).json();
  assert.equal(overview.redirectUri, 'http://localhost:8080/api/auth/google/callback');
  assert.equal(overview.publicBaseUrl, 'http://localhost:8080');
  await app.close();
});
