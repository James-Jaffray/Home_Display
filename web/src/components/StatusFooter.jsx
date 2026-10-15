import { joinTime } from '../lib/time.js';

const STATUS_TEXT = {
  'needs-reconnect': 'reconnect needed',
  'not-connected': 'not connected yet',
  stale: 'may be out of date',
  error: 'unavailable',
  pending: 'loading',
  unsupported: 'not supported yet',
};

/**
 * One line under the calendar: when it last updated, and anything that needs attention.
 * @param {{agenda: {calendars: Array<{id: string, label: string, status: string, updatedAt: string|null}>}, offline: boolean, formatTime: Function}} props
 */
export default function StatusFooter({ agenda, offline, formatTime }) {
  const problems = agenda.calendars.filter((c) => c.status !== 'ok');
  const updated = agenda.calendars.map((c) => c.updatedAt).filter(Boolean).sort().at(-1);

  return (
    <footer className="text-[length:calc(var(--fs,1)*min(3.2vw,2.2vh))] text-text-muted">
      {offline && <span className="mr-3 text-warn">Can’t reach the server</span>}
      {problems.map((c) => (
        <span key={c.id} className="mr-3 text-warn">
          {c.label}: {STATUS_TEXT[c.status] ?? c.status}
        </span>
      ))}
      {updated && <span>Updated {joinTime(formatTime(updated))}</span>}
    </footer>
  );
}
