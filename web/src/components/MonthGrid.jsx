import { useMemo, useState } from 'react';
import useEvents from '../hooks/useEvents.js';
import { CLICKABLE, dayButtonProps } from '../lib/dayButton.js';
import { makeTimeFormatter, shortTime } from '../lib/time.js';
import DayDetail from './DayDetail.jsx';
import StatusFooter from './StatusFooter.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 3;

const monthShort = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short' });

/**
 * A multi-week calendar grid (default 4 weeks, starting with the current week), each day
 * showing its date and events. Rows share the available height so it fills the screen.
 *
 * In interactive mode a date can be clicked to see the whole day.
 *
 * @param {{screenId: string, timezone: string, clock: '12'|'24', weeks: number, weekStart: 'sunday'|'monday', interactive?: boolean}} props
 */
export default function MonthGrid({ screenId, timezone, clock, weeks, weekStart, interactive = false }) {
  const { agenda, offline } = useEvents(screenId, `weeks=${weeks}`);
  const formatTime = useMemo(() => makeTimeFormatter(timezone, clock), [timezone, clock]);
  const [openDate, setOpenDate] = useState(null);

  if (!agenda) return null;

  const colors = Object.fromEntries(agenda.calendars.map((c) => [c.id, c.color]));
  const headings = weekStart === 'monday' ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;
  // Looked up from the latest data, so an open day updates when new events arrive.
  const openDay = interactive ? agenda.days.find((d) => d.date === openDate) : null;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-[1cqh]">
      <div className="grid grid-cols-7 gap-[0.6cqw] text-center text-[length:calc(var(--fs,1)*min(2.6cqw,1.8cqh))] font-semibold tracking-wide text-text-muted uppercase">
        {headings.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7 gap-[0.6cqw]"
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
            interactive={interactive}
            onOpen={() => setOpenDate(day.date)}
          />
        ))}
      </div>

      <StatusFooter agenda={agenda} offline={offline} formatTime={formatTime} />

      {openDay && (
        <DayDetail day={openDay} calendars={agenda.calendars} formatTime={formatTime} onClose={() => setOpenDate(null)} />
      )}
    </section>
  );
}

function DayCell({ day, today, showMonth, colors, formatTime, interactive, onOpen }) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  const dayNumber = Number(day.date.slice(8));
  const shown = day.events.slice(0, MAX_VISIBLE);
  const hidden = day.events.length - shown.length;

  return (
    <div
      className={[
        'flex min-h-0 flex-col overflow-hidden rounded-[0.8cqw] p-[0.6cqw] text-left',
        isToday ? 'bg-accent/25 ring-2 ring-accent' : 'bg-surface-raised/70',
        isPast ? 'opacity-50' : '',
        interactive ? CLICKABLE : '',
      ].join(' ')}
      {...dayButtonProps(interactive, `${dayNumber}, show the full day`, onOpen)}
    >
      <div className="mb-[0.4cqh] flex items-baseline gap-[0.5cqw] leading-none">
        <span className={`text-[length:calc(var(--fs,1)*min(3.6cqw,2.6cqh))] font-semibold ${isToday ? 'text-accent' : ''}`}>{dayNumber}</span>
        {showMonth && (
          <span className="text-[length:calc(var(--fs,1)*min(2.4cqw,1.7cqh))] text-text-muted uppercase">
            {monthShort.format(new Date(`${day.date}T00:00:00Z`))}
          </span>
        )}
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-[0.3cqh] overflow-hidden">
        {shown.map((event) => (
          <li
            key={`${event.calendarId}-${event.id}`}
            className="line-clamp-2 rounded-[0.4cqw] border-l-[0.5cqw] px-[0.5cqw] py-[0.15cqh] text-[length:calc(var(--fs,1)*min(2.3cqw,1.55cqh))] leading-tight break-words"
            style={{
              borderLeftColor: colors[event.calendarId],
              backgroundColor: event.allDay
                ? `color-mix(in srgb, ${colors[event.calendarId]} 40%, transparent)`
                : undefined,
            }}
          >
            {!event.allDay && <span className="mr-[0.4cqw] text-text-muted">{shortTime(formatTime(event.start))}</span>}
            {event.title}
          </li>
        ))}
        {hidden > 0 && <li className="text-[length:calc(var(--fs,1)*min(2.2cqw,1.5cqh))] text-text-muted">+{hidden} more</li>}
      </ul>
    </div>
  );
}
