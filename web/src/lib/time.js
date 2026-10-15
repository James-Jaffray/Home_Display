/**
 * Time formatting in the SCREEN's timezone (never the browser's).
 */

/**
 * Build a formatter that returns the time and the AM/PM part separately, so the UI can
 * shrink "PM" and a 12-hour time never wraps on a narrow portrait screen.
 *
 * @param {string} timezone  IANA name
 * @param {'12'|'24'} clock
 * @returns {(date: Date|string|number) => {time: string, period: string|null}}
 */
export function makeTimeFormatter(timezone, clock) {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: clock === '24' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hourCycle: clock === '24' ? 'h23' : 'h12',
  });

  return (date) => {
    const parts = format.formatToParts(new Date(date));
    const time = parts
      .filter((p) => p.type !== 'dayPeriod')
      .map((p) => p.value)
      .join('')
      .trim();
    // en-CA renders "p.m."; show plain "PM".
    const period = parts.find((p) => p.type === 'dayPeriod')?.value.replace(/\./g, '').toUpperCase() ?? null;
    return { time, period };
  };
}

/**
 * Friendly heading for a "YYYY-MM-DD" agenda day: Today, Tomorrow, then "Friday, Oct 16".
 * @param {string} date
 * @param {string} today  "YYYY-MM-DD" from the server (already in the screen's timezone)
 */
export function dayHeading(date, today) {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  // Formatting a UTC midnight in UTC prints the same calendar date we were given.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * "3:05" + "PM" -> "3:05 PM".
 * @param {{time: string, period: string|null}} formatted
 */
export function joinTime({ time, period }) {
  return period ? `${time} ${period}` : time;
}

/**
 * Compact time for tight spaces: "3p", "3:30p" (12h) or "15:30" (24h).
 * @param {{time: string, period: string|null}} formatted
 */
export function shortTime({ time, period }) {
  if (!period) return time;
  return `${time.replace(/:00$/, '')}${period[0].toLowerCase()}`;
}
