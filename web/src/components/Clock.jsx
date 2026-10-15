import { useMemo } from 'react';
import useNow from '../hooks/useNow.js';

/**
 * Time and date in the screen's configured timezone (not the browser's: a kitchen Pi
 * with a wrong system zone must still show the right time).
 * @param {{timezone: string, clock: '12'|'24'}} props
 */
export default function Clock({ timezone, clock }) {
  const now = useNow();

  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        hour: clock === '24' ? '2-digit' : 'numeric',
        minute: '2-digit',
        hourCycle: clock === '24' ? 'h23' : 'h12',
      }),
      date: new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    }),
    [timezone, clock],
  );

  // AM/PM is split out and shrunk so "12:00 PM" never wraps in a narrow portrait screen.
  const parts = formats.time.formatToParts(now);
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();
  // en-CA renders "p.m."; show plain "PM".
  const period = parts.find((p) => p.type === 'dayPeriod')?.value.replace(/\./g, '').toUpperCase();

  return (
    <div className="[text-shadow:0_2px_24px_rgb(0_0_0/0.6)]">
      <div className="text-[min(26vw,20vh)] leading-none font-semibold whitespace-nowrap tabular-nums">
        {time}
        {period && <span className="ml-[0.15em] text-[0.35em] font-medium text-text-muted">{period}</span>}
      </div>
      <div className="mt-[2vh] text-[min(6vw,5vh)] text-text-muted">{formats.date.format(now)}</div>
    </div>
  );
}
