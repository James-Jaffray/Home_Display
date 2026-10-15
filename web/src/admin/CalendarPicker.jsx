import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * The one place to choose which calendars a screen shows: pick a connected Google account,
 * then flip a switch per calendar (shared ones included) for THIS screen.
 *
 * @param {object} props
 * @param {Array<{account: string, connected: boolean}>} props.accounts
 * @param {Array<{id: string, account: string|null, calendarId: string|null, status: string}>} props.known
 *        calendars the server already has (from config.yaml or added earlier)
 * @param {string[]} props.shownIds  calendar ids currently shown on this screen
 * @param {Record<string, string>} props.statusLabel  status code -> words
 * @param {(account: string, choice: object, on: boolean, match?: object) => Promise<void>} props.onToggle
 *        `match` is the already-known calendar for this choice, if any
 */
export default function CalendarPicker({ accounts, known, shownIds, statusLabel, onToggle }) {
  const connected = accounts.filter((a) => a.connected);
  const [selected, setSelected] = useState('');
  // Fall back to the first connected account if nothing (valid) is selected yet.
  const account = connected.some((a) => a.account === selected) ? selected : (connected[0]?.account ?? '');

  // What Google returned, tagged with the account it belongs to; "loading" is derived from
  // that, so switching account never shows the previous account's calendars.
  const [result, setResult] = useState({ account: '', calendars: [], error: '' });
  // Calendars with a change in flight; their switch is disabled until it finishes.
  const [busy, setBusy] = useState(() => new Set());
  const [flipError, setFlipError] = useState('');

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    api(`/api/admin/accounts/${encodeURIComponent(account)}/calendars`)
      .then(({ calendars }) => !cancelled && setResult({ account, calendars, error: '' }))
      .catch((err) => !cancelled && setResult({ account, calendars: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [account]);

  if (connected.length === 0) {
    return <p className="text-text-muted">Connect a Google account above to choose its calendars.</p>;
  }

  const loading = result.account !== account;

  /** The server-side calendar that matches a Google one, if we already know it. */
  function findKnown(choice) {
    return known.find(
      (c) =>
        c.account === account && (c.calendarId === choice.calendarId || (c.calendarId === 'primary' && choice.primary)),
    );
  }

  async function flip(choice, on) {
    setBusy((b) => new Set(b).add(choice.calendarId));
    setFlipError('');
    try {
      await onToggle(account, choice, on, findKnown(choice));
    } catch (err) {
      setFlipError(err.problems?.[0] ?? err.message);
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(choice.calendarId);
        return next;
      });
    }
  }

  return (
    <div>
      <label className="mb-3 block">
        <span className="label">Whose calendars</span>
        <select className="field" value={account} onChange={(e) => setSelected(e.target.value)}>
          {connected.map((a) => (
            <option key={a.account} value={a.account}>
              {a.account}
            </option>
          ))}
        </select>
      </label>

      {(result.error && !loading) || flipError ? <p className="mb-2 text-danger">{flipError || result.error}</p> : null}
      {loading && <p className="text-text-muted">Loading…</p>}

      <ul className="flex flex-col gap-3">
        {!loading &&
          result.calendars.map((c) => {
            const match = findKnown(c);
            const on = Boolean(match && shownIds.includes(match.id));
            const problem = match && on && match.status !== 'ok' ? (statusLabel[match.status] ?? match.status) : null;
            return (
              <li key={c.calendarId} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.label}</span>
                  {problem && <span className="shrink-0 text-sm text-warn">{problem}</span>}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Show ${c.label} on this screen`}
                  className="toggle"
                  disabled={busy.has(c.calendarId)}
                  onClick={() => flip(c, !on)}
                />
              </li>
            );
          })}
      </ul>
    </div>
  );
}
