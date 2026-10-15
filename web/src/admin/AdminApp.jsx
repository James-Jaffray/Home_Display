import { useCallback, useEffect, useState } from 'react';
import { UiIcon } from '../lib/icons.jsx';
import { api } from './api.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import './admin.css';

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

  if (!session) return <div className="admin" />;

  if (!session.enabled) {
    return (
      <Centered>
        <div className="panel text-center">
          <span className="brand-mark mx-auto">
            <UiIcon name="access" className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">The dashboard is turned off</h1>
          <p className="card-lede">
            Set <code>ADMIN_PASSWORD</code> in your <code>.env</code> file and restart the server to turn it on.
          </p>
        </div>
      </Centered>
    );
  }

  if (!session.authenticated) {
    return (
      <Centered>
        <Login onLoggedIn={recheck} unreachable={session.unreachable} />
      </Centered>
    );
  }

  return (
    <div className="admin">
      <Dashboard
        onLoggedOut={() => {
          api('/api/admin/logout', { method: 'POST', body: {} }).finally(recheck);
        }}
        onSessionLost={recheck}
      />
    </div>
  );
}

/** A page with one card in the middle (login, "turned off"). */
function Centered({ children }) {
  return (
    <div className="admin flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
