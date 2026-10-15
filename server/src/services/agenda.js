/**
 * Turns a flat list of events into "what to show for the next N days".
 *
 * Everything here uses the SCREEN's timezone, never the server's or the browser's:
 * a kitchen Pi with a wrong system clock zone must still agree on what "today" is.
 */

/**
 * "YYYY-MM-DD" for an instant, as seen in a timezone. (en-CA formats dates this way.)
 * @param {Date|number} instant
 * @param {string} timezone
 */
export function localDate(instant, timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Add whole days to a "YYYY-MM-DD" string. Done in UTC so DST can never shift the date.
 * @param {string} date
 * @param {number} n
 */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The first day of the week containing `date`.
 * @param {string} date  "YYYY-MM-DD"
 * @param {"sunday"|"monday"} weekStart
 */
export function weekStartDate(date, weekStart) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const back = weekStart === "monday" ? (dow + 6) % 7 : dow;
  return addDays(date, -back);
}

/** Every "YYYY-MM-DD" from first to last, inclusive. */
function dateRange(first, last) {
  const dates = [];
  for (let d = first; d <= last; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/**
 * The dates (in the screen's timezone) that an event touches.
 * @param {import('./google/calendarApi.js').CalendarEvent} event
 * @param {string} timezone
 */
function eventDates(event, timezone) {
  if (event.allDay) {
    // End date is exclusive: an all-day event "ending tomorrow" ends today.
    const last = addDays(event.end, -1);
    return dateRange(event.start, last < event.start ? event.start : last);
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  // An event ending exactly at midnight belongs to the day before, hence "- 1".
  const lastInstant = end > start ? new Date(end.getTime() - 1) : start;
  return dateRange(localDate(start, timezone), localDate(lastInstant, timezone));
}

/**
 * @param {object} options
 * @param {Array<import('./google/calendarApi.js').CalendarEvent & {calendarId: string}>} options.events
 * @param {string} options.timezone  IANA name, e.g. "America/Edmonton"
 * @param {number} options.days      how many days to show
 * @param {string} [options.startDate]  first day to show; defaults to today (month grid passes the week start)
 * @param {number} options.nowMs     current time, injected so tests are deterministic
 */
export function buildAgenda({ events, timezone, days, nowMs, startDate }) {
  const today = localDate(nowMs, timezone);
  const first = startDate ?? today;
  const dates = Array.from({ length: days }, (_, i) => addDays(first, i));
  const byDate = new Map(dates.map((d) => [d, []]));

  for (const event of events) {
    for (const date of eventDates(event, timezone)) {
      byDate.get(date)?.push({
        id: event.id,
        calendarId: event.calendarId,
        title: event.title,
        location: event.location,
        allDay: event.allDay,
        start: event.start,
        end: event.end,
        // Lets the UI dim events that are already over.
        ended: !event.allDay && new Date(event.end).getTime() <= nowMs,
      });
    }
  }

  for (const list of byDate.values()) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1; // all-day events on top
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }

  return { today, days: dates.map((date) => ({ date, events: byDate.get(date) })) };
}
