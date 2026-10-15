import { useMemo } from 'react';
import useEvents from '../hooks/useEvents.js';
import { makeTimeFormatter, shortTime } from '../lib/time.js';
import StatusFooter from './StatusFooter.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 3;

const monthShort = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short' });

/**
 * A multi-week calendar grid (default 4 weeks, starting with the current week), each day
 * showing its date and events. Rows share the available height so it fills the screen.
 *
 * @param {{screenId: string, timezone: string, clock: '12'|'24', weeks: number, weekStart: 'sunday'|'monday'}} props
 */
export default function MonthGrid({ screenId, timezone, clock, weeks, weekStart }) {
  const { agenda, offline } = useEvents(screenId, `weeks=${weeks}`);
  const formatTime = useMemo(() => makeTimeFormatter(timezone, clock), [timezone, clock]);

  if (!agenda) return null;

  const colors = Object.fromEntries(agenda.calendars.map((c) => [c.id, c.color]));
  const headings = weekStart === 'monday' ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-[1vh]">
      <div className="grid grid-cols-7 gap-[0.6vw] text-center text-[length:calc(var(--fs,1)*min(2.6vw,1.8vh))] font-semibold tracking-wide text-text-muted uppercase">
        {headings.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7 gap-[0.6vw]"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {agenda.days.map((day, i) => (
          <DayCell
            key={day.date}
            day={day}
            today={agenda.today}
            showMonth={i === 0 || day.date.endsWith('-01')}
            colors={colors}
            formatTime={formatTime}
          />
        ))}
      </div>

      <StatusFooter agenda={agenda} offline={offline} formatTime={formatTime} />
    </section>
  );
}

function DayCell({ day, today, showMonth, colors, formatTime }) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  const dayNumber = Number(day.date.slice(8));
  const shown = day.events.slice(0, MAX_VISIBLE);
  const hidden = day.events.length - shown.length;

  return (
    <div
      className={[
        'flex min-h-0 flex-col overflow-hidden rounded-[0.8vw] p-[0.6vw] text-left',
        isToday ? 'bg-accent/25 ring-2 ring-accent' : 'bg-surface-raised/70',
        isPast ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="mb-[0.4vh] flex items-baseline gap-[0.5vw] leading-none">
        <span className={`text-[length:calc(var(--fs,1)*min(3.6vw,2.6vh))] font-semibold ${isToday ? 'text-accent' : ''}`}>{dayNumber}</span>
        {showMonth && (
          <span className="text-[length:calc(var(--fs,1)*min(2.4vw,1.7vh))] text-text-muted uppercase">
            {monthShort.format(new Date(`${day.date}T00:00:00Z`))}
          </span>
        )}
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-[0.3vh] overflow-hidden">
        {shown.map((event) => (
          <li
            key={`${event.calendarId}-${event.id}`}
            className="line-clamp-2 rounded-[0.4vw] border-l-[0.5vw] px-[0.5vw] py-[0.15vh] text-[length:calc(var(--fs,1)*min(2.3vw,1.55vh))] leading-tight break-words"
            style={{
              borderLeftColor: colors[event.calendarId],
              backgroundColor: event.allDay
                ? `color-mix(in srgb, ${colors[event.calendarId]} 40%, transparent)`
                : undefined,
            }}
          >
            {!event.allDay && <span className="mr-[0.4vw] text-text-muted">{shortTime(formatTime(event.start))}</span>}
            {event.title}
          </li>
        ))}
        {hidden > 0 && <li className="text-[length:calc(var(--fs,1)*min(2.2vw,1.5vh))] text-text-muted">+{hidden} more</li>}
      </ul>
    </div>
  );
}
