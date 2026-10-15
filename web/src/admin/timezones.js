/** The timezone names this browser knows (falls back to a short list on very old browsers). */
export function timezoneNames() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['America/Edmonton', 'America/Toronto', 'America/Vancouver', 'America/New_York', 'Europe/London', 'UTC'];
  }
}
