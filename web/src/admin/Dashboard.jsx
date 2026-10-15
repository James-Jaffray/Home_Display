import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import ScreenCard from './ScreenCard.jsx';

const STATUS_LABEL = {
  ok: 'working',
  pending: 'loading…',
  stale: 'out of date',
  error: 'error',
  'needs-reconnect': 'reconnect needed',
  'not-connected': 'not connected',
  unsupported: 'not supported yet',
};

/**
 * Everything you can change: accounts at the top, then one card per screen.
 * @param {{onLoggedOut: () => void, onSessionLost: () => void}} props
 */
export default function Dashboard({ onLoggedOut, onSessionLost }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  // Used by the children after they change something: reload and wait for the result.
  const reload = useCallback(async () => {
    try {
      setOverview(await api('/api/admin/overview'));
      setError('');
    } catch (err) {
      if (err.status === 401) onSessionLost();
      else setError(err.message);
    }
  }, [onSessionLost]);

  // Initial load, then every 15 s: calendar status changes on its own (a token expires,
  // a sync finishes).
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api('/api/admin/overview');
        if (cancelled) return;
        setOverview(data);
        setError('');
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) onSessionLost();
        else setError(err.message);
      }
    }
    poll();
    const timer = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onSessionLost]);

  if (!overview) return <p className="text-text-muted">{error || 'Loading…'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Home-Display dashboard</h1>
        <button className="btn" onClick={onLoggedOut}>
          Log out
        </button>
      </header>
      {error && <p className="text-danger">{error}</p>}

      <section className="panel">
        <h2 className="text-lg font-semibold">Google accounts</h2>
        {!overview.googleConfigured && (
          <p className="mt-2 text-warn">
            GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set, so accounts cannot be connected.
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {overview.accounts.map((a) => (
            <li key={a.account} className="flex items-center justify-between gap-3">
              <span>
                <strong>{a.account}</strong>{' '}
                <span className={a.connected ? 'text-text-muted' : 'text-warn'}>
                  {a.connected ? 'connected' : 'not connected'}
                </span>
              </span>
              {overview.googleConfigured && (
                <a className="btn" href={`/api/auth/google/start?account=${encodeURIComponent(a.account)}`}>
                  {a.connected ? 'Reconnect' : 'Connect'}
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-text-muted">
          Connecting opens Google’s own sign-in page. Your password is never shared with this app.
        </p>
      </section>

      {overview.screens.map((screen) => (
        <ScreenCard
          key={screen.id}
          screen={screen}
          calendars={overview.calendars}
          accounts={overview.accounts}
          statusLabel={STATUS_LABEL}
          onChanged={reload}
        />
      ))}
    </div>
  );
}
