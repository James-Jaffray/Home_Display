import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Accounts from './Accounts.jsx';
import AddDisplay from './AddDisplay.jsx';
import Header from './Header.jsx';
import Preview from './Preview.jsx';
import DisplaySettings from './DisplaySettings.jsx';
import Tabs from './Tabs.jsx';

const STATUS_LABEL = {
  ok: 'working',
  pending: 'loading…',
  stale: 'out of date',
  error: 'error',
  'needs-reconnect': 'reconnect needed',
  'not-connected': 'not connected',
};

/** Remembering the last tab and display is a convenience only: it must never break the page. */
function remembered(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private window or blocked storage: fine, it just will not be remembered
  }
}

/**
 * The dashboard: a header to pick the display, tabs for each part of it, and a live
 * preview beside the settings.
 *
 * @param {{onLoggedOut: () => void, onSessionLost: () => void}} props
 */
export default function Dashboard({ onLoggedOut, onSessionLost }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(() => remembered('hd-display', ''));
  const [tab, setTab] = useState(() => remembered('hd-tab', 'look'));
  const [adding, setAdding] = useState(false);

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

  if (!overview) {
    return <p className="p-8 text-center text-text-muted">{error || 'Loading…'}</p>;
  }

  // The display being edited; falls back to the first if the remembered one is gone.
  const selected = overview.screens.find((s) => s.id === selectedId) ?? overview.screens[0];
  const chooseDisplay = (id) => {
    setSelectedId(id);
    remember('hd-display', id);
  };
  const chooseTab = (id) => {
    setTab(id);
    remember('hd-tab', id);
  };

  return (
    <>
      <Header
        screens={overview.screens}
        selectedId={selected.id}
        onSelect={chooseDisplay}
        onAdd={() => setAdding((open) => !open)}
        onLogout={onLoggedOut}
      />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <main className="min-w-0">
          {error && <p className="mb-4 text-danger">{error}</p>}

          {adding && (
            <div className="mb-5">
              <AddDisplay
                screens={overview.screens}
                defaultTimezone={selected.timezone}
                onCancel={() => setAdding(false)}
                onCreated={async (id) => {
                  setAdding(false);
                  await reload();
                  chooseDisplay(id);
                }}
              />
            </div>
          )}

          <Tabs current={tab} onChange={chooseTab} />

          <div className="mt-5">
            {tab === 'accounts' ? (
              <Accounts
                accounts={overview.accounts}
                googleConfigured={overview.googleConfigured}
                redirectUri={overview.redirectUri}
                onChanged={reload}
              />
            ) : (
              // key: switching display starts a fresh form, so edits never leak between displays
              <DisplaySettings
                key={selected.id}
                section={tab}
                screen={selected}
                calendars={overview.calendars}
                accounts={overview.accounts}
                publicBaseUrl={overview.publicBaseUrl}
                statusLabel={STATUS_LABEL}
                onChanged={reload}
                onDeleted={async () => {
                  chooseDisplay('');
                  await reload();
                }}
              />
            )}
          </div>
        </main>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Preview key={selected.id} screen={selected} />
        </aside>
      </div>
    </>
  );
}
