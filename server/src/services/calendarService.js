import { GoogleAuthError } from './google/oauth.js';
import { listCalendars, listEvents } from './google/calendarApi.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// The month grid starts at the beginning of the current week, up to 6 days ago.
const LOOKBACK_DAYS = 7;

/**
 * @typedef {'pending'|'ok'|'stale'|'error'|'needs-reconnect'|'not-connected'} CalendarStatus
 *   ok              last fetch worked
 *   stale           last fetch failed, showing the last good data
 *   error           never fetched successfully
 *   needs-reconnect Google rejected the token (revoked or expired): sign in again
 *   not-connected   no token saved for this account yet
 */

/**
 * Keeps every Google calendar's events fresh in memory.
 *
 * - Polls on a timer (default 60 s); the browser never triggers a Google call.
 * - On failure it keeps the last good events and marks them stale.
 * - One fetch window (a week back .. +windowDays) is cached per calendar; screens just
 *   read from the cache.
 * - The calendar list comes from `getConfig()` each time, so calendars added in the
 *   dashboard start loading without a restart.
 *
 * @param {object} deps
 * @param {() => import('../config.js').Config} deps.getConfig
 * @param {ReturnType<import('./tokenStore.js').createTokenStore>} deps.tokens
 * @param {ReturnType<import('./google/oauth.js').createGoogleOAuth>} deps.oauth
 * @param {{warn: Function, info: Function}} [deps.log]
 * @param {number} [deps.refreshMs]
 * @param {number} [deps.windowDays]
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {() => number} [deps.now]
 */
export function createCalendarService({
  getConfig,
  tokens,
  oauth,
  log = { warn() {}, info() {} },
  refreshMs = 60_000,
  windowDays = 50,
  fetchImpl = fetch,
  now = Date.now,
}) {
  /** @type {Map<string, {events: import('./google/calendarApi.js').CalendarEvent[], updatedAt: number|null, status: CalendarStatus}>} */
  const cache = new Map();
  /** @type {Map<string, {token: string, expiresAt: number}>} access tokens by account */
  const accessTokens = new Map();
  let timer = null;
  let running = false;

  /** The cache entry for a calendar, created on first use. */
  function entryFor(id) {
    let entry = cache.get(id);
    if (!entry) {
      entry = { events: [], updatedAt: null, status: 'pending' };
      cache.set(id, entry);
    }
    return entry;
  }

  async function accessTokenFor(account) {
    const cached = accessTokens.get(account);
    if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
    const refreshToken = await tokens.get(account);
    if (!refreshToken) throw new GoogleAuthError('not_connected');
    const { accessToken, expiresInSec } = await oauth.refreshAccessToken(refreshToken);
    accessTokens.set(account, { token: accessToken, expiresAt: now() + expiresInSec * 1000 });
    return accessToken;
  }

  /** Run a Google call, retrying once with a fresh access token if the cached one was rejected. */
  async function withAccessToken(account, call) {
    try {
      return await call(await accessTokenFor(account));
    } catch (err) {
      if (!(err instanceof GoogleAuthError && err.code === 'unauthorized')) throw err;
      accessTokens.delete(account);
      return call(await accessTokenFor(account));
    }
  }

  /** Fetch one calendar and update its cache entry. Never throws. */
  async function refreshCalendar(id) {
    const cal = getConfig().calendars[id];
    if (!cal) return;
    const entry = entryFor(id);
    try {
      const timeMin = new Date(now() - LOOKBACK_DAYS * DAY_MS);
      const timeMax = new Date(now() + windowDays * DAY_MS);
      entry.events = await withAccessToken(cal.account, (accessToken) =>
        listEvents({ accessToken, calendarId: cal.calendarId, timeMin, timeMax, fetchImpl }),
      );
      entry.updatedAt = now();
      entry.status = 'ok';
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        entry.status = err.code === 'not_connected' ? 'not-connected' : 'needs-reconnect';
      } else {
        entry.status = entry.updatedAt ? 'stale' : 'error';
      }
      // Calendar id and error code only: never titles, tokens or URLs.
      log.warn({ calendar: id, status: entry.status, reason: err.code ?? err.message }, 'calendar refresh failed');
    }
  }

  async function refreshAll() {
    if (running) return;
    running = true;
    try {
      await Promise.all(Object.keys(getConfig().calendars).map(refreshCalendar));
    } finally {
      running = false;
    }
  }

  return {
    refreshCalendar,
    refreshAll,

    /** Refresh every calendar that belongs to one account (after connecting it). */
    refreshAccount(account) {
      accessTokens.delete(account);
      const ids = Object.entries(getConfig().calendars)
        .filter(([, c]) => c.account === account)
        .map(([id]) => id);
      return Promise.all(ids.map(refreshCalendar));
    },

    /**
     * The Google calendars an account can see (for the dashboard's "add a calendar").
     * @param {string} account
     */
    listAccountCalendars(account) {
      return withAccessToken(account, (accessToken) => listCalendars({ accessToken, fetchImpl }));
    },

    /**
     * The Google address behind an access token (its primary calendar's id), or null.
     * Used right after sign-in to record who an account name belongs to.
     * @param {string} accessToken
     */
    async primaryAddress(accessToken) {
      try {
        const list = await listCalendars({ accessToken, fetchImpl });
        return list.find((c) => c.primary)?.calendarId ?? null;
      } catch {
        return null; // not essential
      }
    },

    start() {
      refreshAll();
      timer = setInterval(refreshAll, refreshMs);
      timer.unref();
    },

    stop() {
      clearInterval(timer);
    },

    /**
     * Cached events and health for a set of calendar ids.
     * @param {string[]} ids
     */
    snapshot(ids) {
      const config = getConfig();
      const calendars = [];
      const events = [];
      for (const id of ids) {
        const cal = config.calendars[id];
        if (!cal) continue;
        const entry = entryFor(id);
        calendars.push({
          id,
          label: cal.label,
          color: cal.color,
          status: entry.status,
          updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
        });
        for (const event of entry.events) events.push({ ...event, calendarId: id });
      }
      return { calendars, events };
    },
  };
}
