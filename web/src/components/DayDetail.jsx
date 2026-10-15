import { useEffect } from 'react';
import { joinTime } from '../lib/time.js';

// "Thursday, October 15": the date string is already the screen's local date, so format it
// as UTC to print exactly those numbers.
const fullDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });

/**
 * Everything on one day, opened by clicking a date in interactive mode. It covers the whole
 * display (the stage), so it also works when the picture is rotated. Click outside it, press
 * Escape, or use the close button to go back.
 *
 * @param {object} props
 * @param {{date: string, events: Array}} props.day
 * @param {Array<{id: string, label: string, color: string}>} props.calendars
 * @param {(date: string|number) => {time: string, period: string|null}} props.formatTime
 * @param {() => void} props.onClose
 */
export default function DayDetail({ day, calendars, formatTime, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byId = Object.fromEntries(calendars.map((c) => [c.id, c]));
  const heading = fullDate.format(new Date(`${day.date}T00:00:00Z`));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-[4cqw]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-[88cqw] flex-col overflow-hidden rounded-[2cqw] border border-white/15 bg-surface-raised text-left shadow-2xl"
      >
        <header className="flex items-center justify-between gap-[2cqw] border-b border-white/10 px-[3cqw] py-[1.6cqh]">
          <h2 className="text-[length:calc(var(--fs,1)*min(4.6cqw,3.4cqh))] font-semibold">{heading}</h2>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close"
            className="flex size-[min(7cqw,5cqh)] shrink-0 items-center justify-center rounded-full border border-white/20 text-[length:calc(var(--fs,1)*min(4cqw,3cqh))] hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        </header>

        <ul className="flex min-h-0 flex-col gap-[1.2cqh] overflow-y-auto px-[3cqw] py-[2cqh]">
          {day.events.length === 0 && (
            <li className="text-[length:calc(var(--fs,1)*min(3.6cqw,2.6cqh))] text-text-muted">Nothing planned.</li>
          )}
          {day.events.map((event) => {
            const calendar = byId[event.calendarId];
            return (
              <li
                key={`${event.calendarId}-${event.id}`}
                className="rounded-[1cqw] border-l-[1cqw] bg-surface/60 px-[2cqw] py-[1cqh]"
                style={{ borderLeftColor: calendar?.color }}
              >
                <div className="text-[length:calc(var(--fs,1)*min(3.2cqw,2.3cqh))] text-text-muted tabular-nums">
                  {event.allDay ? 'All day' : `${joinTime(formatTime(event.start))} – ${joinTime(formatTime(event.end))}`}
                </div>
                <div className="text-[length:calc(var(--fs,1)*min(4.2cqw,3.1cqh))] leading-tight font-medium break-words">
                  {event.title}
                </div>
                {event.location && (
                  <div className="text-[length:calc(var(--fs,1)*min(3cqw,2.2cqh))] text-text-muted">{event.location}</div>
                )}
                {calendar && (
                  <div className="text-[length:calc(var(--fs,1)*min(2.8cqw,2cqh))] text-text-muted">{calendar.label}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
