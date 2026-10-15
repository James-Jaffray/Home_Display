import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { normalizeEvent } from '../src/services/google/calendarApi.js';
import { buildApp } from '../src/app.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-cal-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const config = validateConfig({
  defaultScreen: 'kitchen',
  calendars: {
    mine: { provider: 'google', account: 'james', label: 'James', color: '#112233' },
    other: { provider: 'google', account: 'parents', label: 'Parents', color: '#445566' },
  },
  screens: {
    kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['mine'] },
    parents: { title: 'Parents', timezone: 'America/Edmonton', calendars: ['other'] },
  },
});

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake Google: token endpoint plus a calendar endpoint whose behaviour tests can change. */
function fakeGoogle() {
  const state = { calendarStatus: 200, tokenError: null, calls: [] };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    state.calls.push(u);
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      if (state.tokenError) return jsonResponse({ error: state.tokenError }, 400);
      const body = new URLSearchParams(init.body);
      if (body.get('grant_type') === 'authorization_code') {
        return jsonResponse({ access_token: 'at', refresh_token: 'rt-new', expires_in: 3600 });
      }
      return jsonResponse({ access_token: 'at', expires_in: 3600 });
    }
    if (state.calendarStatus !== 200) return jsonResponse({}, state.calendarStatus);
    const soon = new Date(Date.now() + 3600_000).toISOString();
    const later = new Date(Date.now() + 7200_000).toISOString();
    return jsonResponse({
      items: [
        { id: '1', summary: 'Dentist', start: { dateTime: soon }, end: { dateTime: later } },
        { id: '2', status: 'cancelled', summary: 'Gone', start: { dateTime: soon }, end: { dateTime: later } },
      ],
    });
  };
  return { state, fetchImpl };
}

function setup(overrides = {}) {
  const google = fakeGoogle();
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: 'id', clientSecret: 'secret' },
    adminPassword: 'test-password',
    ...overrides,
  };
  const services = createServices({ config, settings, fetchImpl: google.fetchImpl });
  return { google, settings, services };
}

test('normalizeEvent drops cancelled events and keeps all-day dates', () => {
  assert.equal(normalizeEvent({ status: 'cancelled', start: {}, end: {} }), null);
  const e = normalizeEvent({ id: 'x', summary: 'Trip', start: { date: '2026-10-14' }, end: { date: '2026-10-16' } });
  assert.equal(e.allDay, true);
  assert.equal(e.end, '2026-10-16');
});

test('token store round-trips and is not world-readable', async () => {
  const { services } = setup();
  await services.tokens.set('james', 'rt-1');
  assert.equal(await services.tokens.get('james'), 'rt-1');
  assert.equal(await services.tokens.get('nobody'), null);
  if (process.platform !== 'win32') {
    assert.equal(statSync(join(dir, 'data', 'tokens.json')).mode & 0o077, 0);
  }
});

test('without a token the calendar is "not-connected"', async () => {
  const { services } = setup();
  await services.calendars.refreshAll();
  assert.equal(services.calendars.snapshot(['mine']).calendars[0].status, 'not-connected');
});

test('with a token events load; cancelled ones are dropped', async () => {
  const { services } = setup();
  await services.tokens.set('james', 'rt-1');
  await services.calendars.refreshAll();
  const snap = services.calendars.snapshot(['mine']);
  assert.equal(snap.calendars[0].status, 'ok');
  assert.deepEqual(snap.events.map((e) => e.title), ['Dentist']);
});

test('Google failing keeps the last good events and marks them stale', async () => {
  const { services, google } = setup();
  await services.tokens.set('james', 'rt-1');
  await services.calendars.refreshAll();
  google.state.calendarStatus = 503;
  await services.calendars.refreshAll();
  const snap = services.calendars.snapshot(['mine']);
  assert.equal(snap.calendars[0].status, 'stale');
  assert.equal(snap.events.length, 1);
});

test('a revoked token shows needs-reconnect instead of crashing', async () => {
  const { services, google } = setup();
  await services.tokens.set('james', 'rt-1');
  google.state.tokenError = 'invalid_grant';
  await services.calendars.refreshAll();
  assert.equal(services.calendars.snapshot(['mine']).calendars[0].status, 'needs-reconnect');
});

test('events endpoint: one screen never sees another screen\'s calendars', async () => {
  const { services, settings } = setup();
  await services.tokens.set('james', 'rt-1');
  await services.tokens.set('parents', 'rt-2');
  await services.calendars.refreshAll();
  const app = await buildApp({ settings, services });
  const kitchen = (await app.inject('/api/screens/kitchen/events?days=2')).json();
  assert.deepEqual(kitchen.calendars.map((c) => c.id), ['mine']);
  assert.equal(kitchen.days.length, 2);
  assert.equal((await app.inject('/api/screens/kitchen/events?days=99')).statusCode, 400);
  assert.equal((await app.inject('/api/screens/nope/events')).statusCode, 404);
  await app.close();
});

test('connect flow: needs a dashboard login, rejects forged state, stores the token', async () => {
  const { services, settings } = setup();
  const app = await buildApp({ settings, services });

  // Not logged in: refused.
  assert.equal((await app.inject('/api/auth/google/start?account=james')).statusCode, 401);

  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-password' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const get = (url) => app.inject({ url, headers: { cookie } });

  assert.equal((await get('/api/auth/google/start?account=stranger')).statusCode, 400);
  // The callback comes from Google, so it carries no cookie; a forged state is rejected.
  assert.equal((await app.inject('/api/auth/google/callback?code=x&state=forged')).statusCode, 400);

  const start = await get('/api/auth/google/start?account=james');
  assert.equal(start.statusCode, 302);
  const url = new URL(start.headers.location);
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.readonly');
  assert.equal(url.searchParams.get('access_type'), 'offline');

  const state = url.searchParams.get('state');
  const done = await app.inject(`/api/auth/google/callback?code=abc&state=${state}`);
  assert.equal(done.statusCode, 200);
  assert.equal(await services.tokens.get('james'), 'rt-new');
  // state is single-use
  assert.equal((await app.inject(`/api/auth/google/callback?code=abc&state=${state}`)).statusCode, 400);
  await app.close();
});
