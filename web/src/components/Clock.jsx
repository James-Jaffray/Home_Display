import { useMemo } from 'react';
import useNow from '../hooks/useNow.js';
import { makeTimeFormatter } from '../lib/time.js';

/**
 * Time and date in the screen's configured timezone (not the browser's: a kitchen Pi
 * with a wrong system zone must still show the right time).
 * @param {{timezone: string, clock: '12'|'24', compact?: boolean}} props
 */
export default function Clock({ timezone, clock, compact = false }) {
  const now = useNow();

  const formatTime = useMemo(() => makeTimeFormatter(timezone, clock), [timezone, clock]);
  const formatDate = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric' }),
    [timezone],
  );

  const { time, period } = formatTime(now);

  return (
    <div className="[text-shadow:0_2px_24px_rgb(0_0_0/0.6)]">
      <div
        className={`${compact ? 'text-[length:calc(var(--fs,1)*min(18vw,10vh))]' : 'text-[length:calc(var(--fs,1)*min(26vw,20vh))]'} leading-none font-semibold whitespace-nowrap tabular-nums`}
      >
        {time}
        {period && <span className="ml-[0.15em] text-[0.35em] font-medium text-text-muted">{period}</span>}
      </div>
      <div className={`mt-[1vh] ${compact ? 'text-[length:calc(var(--fs,1)*min(4.4vw,3vh))]' : 'text-[length:calc(var(--fs,1)*min(6vw,5vh))]'} text-text-muted`}>{formatDate.format(now)}</div>
    </div>
  );
}
