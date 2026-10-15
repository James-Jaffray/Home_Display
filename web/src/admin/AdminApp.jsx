import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';

/**
 * The /admin page: checks whether you are logged in, then shows the login form or the
 * dashboard.
 */
export default function AdminApp() {
  // null = still checking
  const [session, setSession] = useState(null);
  // Bumping this re-runs the session check (after login or logout).
  const [checks, setChecks] = useState(0);
  const recheck = useCallback(() => setChecks((n) => n + 1), []);

  useEffect(() => {
    document.title = 'Home-Display dashboard';
  }, []);

  useEffect(() => {
    let cancelled = false;
    api('/api/admin/session')
      .then((s) => !cancelled && setSession(s))
      .catch(() => !cancelled && setSession({ enabled: true, authenticated: false, unreachable: true }));
    return () => {
      cancelled = true;
    };
  }, [checks]);

  if (!session) return <Shell />;

  if (!session.enabled) {
    return (
      <Shell>
        <div className="panel">
          <h1 className="text-2xl font-semibold">Dashboard is turned off</h1>
          <p className="mt-2 text-text-muted">
            Set <code>ADMIN_PASSWORD</code> in your <code>.env</code> file and restart the server to enable it.
          </p>
        </div>
      </Shell>
    );
  }

  if (!session.authenticated) {
    return (
      <Shell>
        <Login onLoggedIn={recheck} unreachable={session.unreachable} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Dashboard
        onLoggedOut={() => {
          api('/api/admin/logout', { method: 'POST', body: {} }).finally(recheck);
        }}
        onSessionLost={recheck}
      />
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="mx-auto min-h-full max-w-3xl px-4 py-6">{children}</div>;
}
