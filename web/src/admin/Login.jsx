import { useState } from 'react';
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
    <form onSubmit={submit} className="panel mx-auto mt-[12vh] max-w-sm">
      <h1 className="text-2xl font-semibold">Home-Display</h1>
      <p className="mt-1 text-text-muted">Dashboard login</p>
      <label className="mt-5 block">
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
      {error && <p className="mt-3 text-danger">{error}</p>}
      <button className="btn btn-primary mt-5 w-full" disabled={busy || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
