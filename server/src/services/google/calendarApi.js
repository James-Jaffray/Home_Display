import { GoogleAuthError } from './oauth.js';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string|null} location
 * @property {boolean} allDay
 * @property {string} start  all-day: "YYYY-MM-DD"; timed: ISO date-time with offset
 * @property {string} end    all-day: "YYYY-MM-DD", EXCLUSIVE (Google's rule); timed: ISO
 */

/**
 * Convert one Google API event into our shape. Returns null for cancelled events.
 * @param {any} item
 * @returns {CalendarEvent|null}
 */
export function normalizeEvent(item) {
  if (item.status === 'cancelled') return null;
  const allDay = Boolean(item.start?.date);
  const start = allDay ? item.start.date : item.start?.dateTime;
  const end = allDay ? item.end?.date : item.end?.dateTime;
  if (!start || !end) return null;
  return {
    id: item.id,
    title: item.summary || '(no title)',
    location: item.location || null,
    allDay,
    start,
    end,
  };
}

/**
 * Fetch events in [timeMin, timeMax). `singleEvents=true` makes Google expand recurring
 * events into individual instances (with exceptions applied), so this provider needs no
 * RRULE handling of its own.
 *
 * @param {{accessToken: string, calendarId: string, timeMin: Date, timeMax: Date, fetchImpl?: typeof fetch}} options
 * @returns {Promise<CalendarEvent[]>}
 */
export async function listEvents({ accessToken, calendarId, timeMin, timeMax, fetchImpl = fetch }) {
  const events = [];
  let pageToken;
  do {
    const url = new URL(`${EVENTS_URL}/${encodeURIComponent(calendarId)}/events`);
    url.search = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      fields: 'nextPageToken,items(id,status,summary,location,start,end)',
      ...(pageToken ? { pageToken } : {}),
    }).toString();

    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) throw new GoogleAuthError('unauthorized');
    if (!res.ok) throw new Error(`calendar API http_${res.status}`);

    const body = await res.json();
    for (const item of body.items ?? []) {
      const event = normalizeEvent(item);
      if (event) events.push(event);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return events;
}

const LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

/**
 * The calendars an account can see (its own plus ones shared with it).
 * @param {{accessToken: string, fetchImpl?: typeof fetch}} options
 * @returns {Promise<Array<{calendarId: string, label: string, color: string, primary: boolean}>>}
 */
export async function listCalendars({ accessToken, fetchImpl = fetch }) {
  const url = new URL(LIST_URL);
  url.search = new URLSearchParams({
    minAccessRole: 'reader',
    fields: 'items(id,summary,summaryOverride,backgroundColor,primary)',
  }).toString();
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new GoogleAuthError('unauthorized');
  if (!res.ok) throw new Error(`calendar API http_${res.status}`);
  const body = await res.json();
  return (body.items ?? []).map((c) => ({
    calendarId: c.id,
    label: c.summaryOverride || c.summary || c.id,
    color: /^#[0-9a-fA-F]{6}$/.test(c.backgroundColor ?? '') ? c.backgroundColor : '#4f9dff',
    primary: Boolean(c.primary),
  }));
}
