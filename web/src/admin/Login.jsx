import { useState } from 'react';
import { UiIcon } from '../lib/icons.jsx';
import { api } from './api.js';

/** @param {{onLoggedIn: () => void, unreachable?: boolean}} props */
export default function Login({ onLoggedIn, unreachable }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(unreachable ? 'Server unreachable' : '');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password } });
      onLoggedIn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel">
      <div className="flex flex-col items-center text-center">
        <span className="brand-mark">
          <UiIcon name="brand" className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Home-Display</h1>
        <p className="card-lede">Sign in to the dashboard</p>
      </div>

      <label className="mt-6 block">
        <span className="label">Password</span>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button className="btn btn-primary mt-5 w-full" disabled={busy || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
