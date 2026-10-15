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
  dir = mkdtempSync(join(tmpdir(), 'kd-accounts-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const config = validateConfig({
  defaultScreen: 'kitchen',
  calendars: {
    mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' },
  },
  screens: { kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'] } },
});

/**
 * A fake Google where the sign-in "code" names the person:
 * code "wife" gets wife@example.com as the primary calendar.
 */
function fakeGoogleByCode() {
  const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  return async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      const code = new URLSearchParams(init.body).get('code');
      return json({ access_token: `at-${code}`, refresh_token: `rt-${code}`, expires_in: 3600 });
    }
    if (u.includes('/users/me/calendarList')) {
      const who = String(init.headers.Authorization).replace('Bearer at-', '');
      return json({ items: [{ id: `${who}@example.com`, summary: who, primary: true, backgroundColor: '#336699' }] });
    }
    return json({ items: [] });
  };
}

async function start() {
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: 'id', clientSecret: 'secret' },
    adminPassword: 'pw',
  };
  const services = createServices({ config, settings, fetchImpl: fakeGoogleByCode() });
  await services.init();
  const app = await buildApp({ settings, services });
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'pw' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  return { app, services, cookie };
}

/** The whole sign-in round trip for one account name, as if Google returned `code`. */
async function connect(app, cookie, account, code) {
  const start = await app.inject({ url: `/api/auth/google/start?account=${account}`, headers: { cookie } });
  assert.equal(start.statusCode, 302);
  const params = new URL(start.headers.location).searchParams;
  assert.match(params.get('prompt'), /select_account/);
  return app.inject(`/api/auth/google/callback?code=${code}&state=${params.get('state')}`);
}

test('a second Google account can be added, connected and shown with its address', async () => {
  const { app, services, cookie } = await start();
  const post = (url, payload) => app.inject({ method: 'POST', url, headers: { cookie }, payload });

  assert.equal((await post('/api/admin/accounts', { account: 'Wife!' })).statusCode, 400);
  assert.equal((await post('/api/admin/accounts', { account: 'wife' })).statusCode, 200);
  assert.equal((await post('/api/admin/accounts', { account: 'wife' })).statusCode, 409);
  assert.equal((await post('/api/admin/accounts', { account: 'james' })).statusCode, 409); // from config.yaml

  // A calendar can only be added for a known account.
  const body = { calendarId: 'x@example.com', label: 'X', color: '#00aa88', screens: ['kitchen'] };
  assert.equal((await post('/api/admin/calendars', { ...body, account: 'nobody' })).statusCode, 400);

  assert.equal((await connect(app, cookie, 'james', 'james')).statusCode, 200);
  assert.equal((await connect(app, cookie, 'wife', 'wife')).statusCode, 200);

  const overview = (await app.inject({ url: '/api/admin/overview', headers: { cookie } })).json();
  const byName = Object.fromEntries(overview.accounts.map((a) => [a.account, a]));
  assert.equal(byName.james.email, 'james@example.com');
  assert.equal(byName.wife.email, 'wife@example.com');

  // Both accounts' calendars can sit on the same screen.
  const added = await post('/api/admin/calendars', { ...body, account: 'wife' });
  assert.equal(added.statusCode, 200);
  assert.deepEqual(services.live.get().screens.kitchen.calendars, ['mine', added.json().id]);
  await app.close();
});

test('the same Google address cannot be connected under two names', async () => {
  const { app, services, cookie } = await start();
  await app.inject({ method: 'POST', url: '/api/admin/accounts', headers: { cookie }, payload: { account: 'extra' } });

  assert.equal((await connect(app, cookie, 'james', 'james')).statusCode, 200);
  const duplicate = await connect(app, cookie, 'extra', 'james'); // Google says: this is james again
  assert.equal(duplicate.statusCode, 409);
  assert.equal(await services.tokens.get('extra'), null);
  assert.equal(await services.tokens.get('james'), 'rt-james');
  await app.close();
});

test('disconnecting forgets the token and removes an unused dashboard-added name', async () => {
  const { app, services, cookie } = await start();
  await app.inject({ method: 'POST', url: '/api/admin/accounts', headers: { cookie }, payload: { account: 'wife' } });
  await connect(app, cookie, 'wife', 'wife');
  assert.equal(await services.tokens.get('wife'), 'rt-wife');

  const del = (name) => app.inject({ method: 'DELETE', url: `/api/admin/accounts/${name}`, headers: { cookie } });
  assert.equal((await del('wife')).statusCode, 200);
  assert.equal(await services.tokens.get('wife'), null);
  assert.equal(services.accountNames().includes('wife'), false);
  assert.equal((await del('wife')).statusCode, 404);

  // A config.yaml account is disconnected but its name stays.
  await connect(app, cookie, 'james', 'james');
  assert.equal((await del('james')).statusCode, 200);
  assert.equal(await services.tokens.get('james'), null);
  assert.equal(services.accountNames().includes('james'), true);
  await app.close();
});
