import { useState } from 'react';
import { api } from './api.js';

/**
 * "Add a calendar": pick a connected Google account, see the calendars it can read
 * (including ones shared with it), and add one to this screen.
 *
 * @param {{accounts: Array<{account: string, connected: boolean}>, screenId: string, onAdded: () => void}} props
 */
export default function AddCalendar({ accounts, screenId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState('');
  const [choices, setChoices] = useState(null);
  const [error, setError] = useState('');

  const connected = accounts.filter((a) => a.connected);
  if (connected.length === 0) return null;

  async function load(name) {
    setAccount(name);
    setChoices(null);
    setError('');
    try {
      const { calendars } = await api(`/api/admin/accounts/${encodeURIComponent(name)}/calendars`);
      setChoices(calendars);
    } catch (err) {
      setError(err.message);
    }
  }

  async function add(choice) {
    try {
      await api('/api/admin/calendars', {
        method: 'POST',
        body: { account, calendarId: choice.calendarId, label: choice.label, color: choice.color, screens: [screenId] },
      });
      setOpen(false);
      setChoices(null);
      onAdded();
    } catch (err) {
      setError(err.problems?.[0] ?? err.message);
    }
  }

  if (!open) {
    return (
      <button
        className="btn mt-3"
        onClick={() => {
          setOpen(true);
          load(connected[0].account);
        }}
      >
        Add a calendar from Google…
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 p-3">
      <div className="flex items-center gap-3">
        <select className="field" value={account} onChange={(e) => load(e.target.value)}>
          {connected.map((a) => (
            <option key={a.account} value={a.account}>
              {a.account}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-danger">{error}</p>}
      {!choices && !error && <p className="mt-2 text-text-muted">Loading…</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {choices?.map((c) => (
          <li key={c.calendarId} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="truncate">{c.label}</span>
            </span>
            <button className="btn" onClick={() => add(c)}>
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
