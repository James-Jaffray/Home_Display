import { useMemo } from 'react';
import useEvents from '../hooks/useEvents.js';
import useNow from '../hooks/useNow.js';
import { dayHeading, joinTime, makeTimeFormatter } from '../lib/time.js';
import StatusFooter from './StatusFooter.jsx';

/**
 * Today and the next few days, large type, over the photo background.
 * @param {{screenId: string, timezone: string, clock: '12'|'24', days?: number}} props
 */
export default function Agenda({ screenId, timezone, clock, days = 5 }) {
  const { agenda, offline } = useEvents(screenId, `days=${days}`);
  const now = useNow();
  const formatTime = useMemo(() => makeTimeFormatter(timezone, clock), [timezone, clock]);

  if (!agenda) return null;

  const colors = Object.fromEntries(agenda.calendars.map((c) => [c.id, c.color]));

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-[2.5vh] overflow-hidden text-left">
      <div className="flex min-h-0 flex-1 flex-col gap-[2.5vh] overflow-hidden">
        {agenda.days.map((day, i) => {
          // Skip empty future days; "Today" always shows so a quiet day says so.
          if (day.events.length === 0 && i > 0) return null;
          return (
            <div key={day.date}>
              <h2 className="mb-[1vh] text-[length:calc(var(--fs,1)*min(4.5vw,3.4vh))] font-semibold tracking-wide text-text-muted uppercase">
                {dayHeading(day.date, agenda.today)}
              </h2>
              {day.events.length === 0 && <p className="text-[length:calc(var(--fs,1)*min(5vw,3.6vh))] text-text-muted">Nothing planned</p>}
              <ul className="flex flex-col gap-[1.2vh]">
                {renderEvents(day, i === 0, now.getTime())}
              </ul>
            </div>
          );
        })}
      </div>

      <StatusFooter agenda={agenda} offline={offline} formatTime={formatTime} />
    </section>
  );

  /** Event rows for one day, with a "now" line in today's list. */
  function renderEvents(day, isToday, nowMs) {
    const rows = [];
    let nowShown = false;
    day.events.forEach((event) => {
      const upcoming = event.allDay || !event.ended;
      // Put the marker before the first event that has not finished (timed events only).
      if (isToday && !nowShown && !event.allDay && upcoming) {
        rows.push(<NowMarker key="now" label={joinTime(formatTime(nowMs))} />);
        nowShown = true;
      }
      rows.push(
        <li key={`${event.calendarId}-${event.id}-${day.date}`} className={event.ended ? 'opacity-50' : ''}>
          <div className="flex items-baseline gap-[2vw]">
            <span
              className="mt-[0.9vh] inline-block h-[1.6vh] w-[1.6vh] shrink-0 rounded-full"
              style={{ backgroundColor: colors[event.calendarId] }}
            />
            <span className="w-[22vw] shrink-0 text-[length:calc(var(--fs,1)*min(4.8vw,3.4vh))] text-text-muted tabular-nums">
              {event.allDay ? 'All day' : joinTime(formatTime(event.start))}
            </span>
            <span className="min-w-0 text-[length:calc(var(--fs,1)*min(5.6vw,4vh))] leading-tight font-medium break-words">{event.title}</span>
          </div>
          {event.location && (
            <p className="ml-[calc(1.6vh+2vw+22vw+2vw)] text-[length:calc(var(--fs,1)*min(3.8vw,2.6vh))] text-text-muted">{event.location}</p>
          )}
        </li>,
      );
    });
    if (isToday && !nowShown && day.events.some((e) => !e.allDay)) {
      rows.push(<NowMarker key="now" label={joinTime(formatTime(nowMs))} />);
    }
    return rows;
  }
}

function NowMarker({ label }) {
  return (
    <li className="flex items-center gap-3 text-[length:calc(var(--fs,1)*min(3.4vw,2.4vh))] text-accent" aria-label="current time">
      <span className="h-px flex-1 bg-accent" />
      <span>now {label}</span>
      <span className="h-px flex-1 bg-accent" />
    </li>
  );
}

