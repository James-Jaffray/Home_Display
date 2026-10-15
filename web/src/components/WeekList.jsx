import { useMemo, useState } from 'react';
import useEvents from '../hooks/useEvents.js';
import { CLICKABLE, dayButtonProps } from '../lib/dayButton.js';
import { makeTimeFormatter, shortTime } from '../lib/time.js';
import DayDetail from './DayDetail.jsx';
import StatusFooter from './StatusFooter.jsx';

const MAX_VISIBLE = 5;

const weekdayShort = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'short' });
const monthShort = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short' });

/**
 * One week as seven rows: the date on the left, that day's events on the right. More room
 * per day than the month grid, so titles are readable from across a room.
 *
 * In interactive mode a day can be clicked to see all of it.
 *
 * @param {{screenId: string, timezone: string, clock: '12'|'24', interactive?: boolean}} props
 */
export default function WeekList({ screenId, timezone, clock, interactive = false }) {
  const { agenda, offline } = useEvents(screenId, 'weeks=1');
  const formatTime = useMemo(() => makeTimeFormatter(timezone, clock), [timezone, clock]);
  const [openDate, setOpenDate] = useState(null);

  if (!agenda) return null;
  const colors = Object.fromEntries(agenda.calendars.map((c) => [c.id, c.color]));
  const openDay = interactive ? agenda.days.find((d) => d.date === openDate) : null;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-[1cqh]">
      <div className="grid min-h-0 flex-1 grid-rows-7 gap-[0.7cqh]">
        {agenda.days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            today={agenda.today}
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

function DayRow({ day, today, colors, formatTime, interactive, onOpen }) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  const date = new Date(`${day.date}T00:00:00Z`);
  const shown = day.events.slice(0, MAX_VISIBLE);
  const hidden = day.events.length - shown.length;

  return (
    <div
      className={[
        'grid min-h-0 grid-cols-[17cqw_1fr] items-stretch gap-[2cqw] overflow-hidden rounded-[1cqw] px-[2cqw] py-[0.6cqh] text-left',
        isToday ? 'bg-accent/25 ring-2 ring-accent' : 'bg-surface-raised/70',
        isPast ? 'opacity-50' : '',
        interactive ? CLICKABLE : '',
      ].join(' ')}
      {...dayButtonProps(interactive, `${Number(day.date.slice(8))}, show the full day`, onOpen)}
    >
      <div className="flex flex-col justify-center leading-none">
        <span className="text-[length:calc(var(--fs,1)*min(2.6cqw,1.8cqh))] font-semibold tracking-wide text-text-muted uppercase">
          {isToday ? 'Today' : weekdayShort.format(date)}
        </span>
        <span className={`text-[length:calc(var(--fs,1)*min(6cqw,4.2cqh))] font-semibold ${isToday ? 'text-accent' : ''}`}>
          {Number(day.date.slice(8))}
        </span>
        <span className="text-[length:calc(var(--fs,1)*min(2.4cqw,1.7cqh))] text-text-muted uppercase">
          {monthShort.format(date)}
        </span>
      </div>

      <ul className="flex min-h-0 flex-col justify-center gap-[0.4cqh] overflow-hidden">
        {day.events.length === 0 && isToday && (
          <li className="text-[length:calc(var(--fs,1)*min(3.2cqw,2.2cqh))] text-text-muted">Nothing planned</li>
        )}
        {shown.map((event) => (
          <li
            key={`${event.calendarId}-${event.id}`}
            className="line-clamp-1 rounded-[0.5cqw] border-l-[0.8cqw] px-[1cqw] text-[length:calc(var(--fs,1)*min(3.4cqw,2.4cqh))] leading-tight"
            style={{
              borderLeftColor: colors[event.calendarId],
              backgroundColor: event.allDay
                ? `color-mix(in srgb, ${colors[event.calendarId]} 40%, transparent)`
                : undefined,
            }}
          >
            <span className="mr-[1cqw] text-text-muted tabular-nums">
              {event.allDay ? 'All day' : shortTime(formatTime(event.start))}
            </span>
            {event.title}
          </li>
        ))}
        {hidden > 0 && (
          <li className="text-[length:calc(var(--fs,1)*min(2.8cqw,2cqh))] text-text-muted">+{hidden} more</li>
        )}
      </ul>
    </div>
  );
}
