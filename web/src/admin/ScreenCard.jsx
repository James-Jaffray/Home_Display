import { useRef, useState } from 'react';
import { api } from './api.js';
import AddCalendar from './AddCalendar.jsx';
import Photos from './Photos.jsx';

const LAYOUTS = [
  ['month-grid', 'Calendar grid (weeks)'],
  ['portrait-agenda', 'List of events'],
];

/**
 * All the settings for one screen: how it looks, which calendars, which photos.
 * Changes save automatically.
 *
 * @param {object} props
 * @param {object} props.screen  from /api/admin/overview
 * @param {Array} props.calendars  every calendar the server knows
 * @param {Array} props.accounts
 * @param {Record<string, string>} props.statusLabel
 * @param {() => void} props.onChanged  reload the overview after a change
 */
export default function ScreenCard({ screen, calendars, accounts, statusLabel, onChanged }) {
  // Edits made in the form but not yet confirmed by the server; they sit on top of `screen`.
  const [edits, setEdits] = useState({});
  const draft = { ...screen, ...edits };
  const [saveState, setSaveState] = useState('');
  const timer = useRef(null);

  /** Update the form immediately; send to the server shortly after the last change. */
  function change(patch) {
    setEdits((e) => ({ ...e, ...patch }));
    setSaveState('saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`/api/admin/screens/${screen.id}`, { method: 'PATCH', body: patch });
        setSaveState('saved');
        await onChanged();
        // The refreshed `screen` now holds these values; drop the temporary edits.
        setEdits((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !(key in patch))));
      } catch (err) {
        setSaveState(`not saved: ${err.problems?.[0] ?? err.message}`);
      }
    }, 350);
  }

  function toggleCalendar(calId, on) {
    const next = on ? [...draft.calendars, calId] : draft.calendars.filter((c) => c !== calId);
    change({ calendars: next });
  }

  return (
    <section className="panel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{screen.title}</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-text-muted">{saveState}</span>
          <a className="btn" href={`/${screen.id}`} target="_blank" rel="noreferrer">
            Open display
          </a>
        </div>
      </div>

      <h3 className="group-title">Look</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Layout</span>
          <select className="field" value={draft.layout} onChange={(e) => change({ layout: e.target.value })}>
            {LAYOUTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Clock</span>
          <select className="field" value={draft.clock} onChange={(e) => change({ clock: e.target.value })}>
            <option value="12">12-hour</option>
            <option value="24">24-hour</option>
          </select>
        </label>
        <label>
          <span className="label">Weeks shown</span>
          <select className="field" value={draft.weeks} onChange={(e) => change({ weeks: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Week starts on</span>
          <select className="field" value={draft.weekStart} onChange={(e) => change({ weekStart: e.target.value })}>
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="label">Text size: {Math.round(draft.fontScale * 100)}%</span>
          <input
            className="w-full accent-accent"
            type="range"
            min="0.7"
            max="1.6"
            step="0.05"
            value={draft.fontScale}
            onChange={(e) => change({ fontScale: Number(e.target.value) })}
          />
        </label>
      </div>

      <h3 className="group-title">Calendars</h3>
      <ul className="flex flex-col gap-2">
        {calendars.map((cal) => (
          <li key={cal.id} className="flex items-center justify-between gap-3">
            <label className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-accent"
                checked={draft.calendars.includes(cal.id)}
                onChange={(e) => toggleCalendar(cal.id, e.target.checked)}
              />
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
              <span className="truncate">{cal.label}</span>
              <span className="shrink-0 text-sm text-text-muted">
                {cal.account} · {statusLabel[cal.status] ?? cal.status}
              </span>
            </label>
            {cal.removable && (
              <button
                className="btn"
                onClick={async () => {
                  await api(`/api/admin/calendars/${cal.id}`, { method: 'DELETE' }).catch(() => {});
                  onChanged();
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <AddCalendar accounts={accounts} screenId={screen.id} onAdded={onChanged} />

      <h3 className="group-title">Background photos</h3>
      <label className="mb-3 block">
        <span className="label">Seconds per photo: {draft.photoInterval}</span>
        <input
          className="w-full accent-accent"
          type="range"
          min="5"
          max="300"
          step="5"
          value={draft.photoInterval}
          onChange={(e) => change({ photoInterval: Number(e.target.value) })}
        />
      </label>
      <Photos screenId={screen.id} photos={screen.photos} onChanged={onChanged} />
    </section>
  );
}
