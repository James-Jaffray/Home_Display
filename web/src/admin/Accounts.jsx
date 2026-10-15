import { useState } from 'react';
import { api } from './api.js';

/**
 * The Google accounts section: each connected account with the address it belongs to,
 * connect / reconnect / disconnect, a form to add another person's account, and the
 * "paste the address" step for installs that are only reachable on the home network.
 *
 * @param {object} props
 * @param {Array<{account: string, connected: boolean, email: string|null}>} props.accounts
 * @param {boolean} props.googleConfigured
 * @param {string} props.redirectUri  where Google sends the browser after sign-in
 * @param {() => Promise<void>} props.onChanged  reload the overview
 */
export default function Accounts({ accounts, googleConfigured, redirectUri, onChanged }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const connectUrl = (account) => `/api/auth/google/start?account=${encodeURIComponent(account)}`;

  async function addAccount(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { account } = await api('/api/admin/accounts', { method: 'POST', body: { account: name.trim().toLowerCase() } });
      // Straight on to Google's sign-in so the new account is connected in one go.
      window.location.href = connectUrl(account);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function disconnect(account) {
    if (!window.confirm(`Disconnect "${account}"? Its calendars stop showing until you connect it again.`)) return;
    await api(`/api/admin/accounts/${encodeURIComponent(account)}`, { method: 'DELETE' }).catch((err) => setError(err.message));
    await onChanged();
  }

  return (
    <section className="panel">
      <h2 className="text-lg font-semibold">Google accounts</h2>
      {!googleConfigured && (
        <p className="mt-2 text-warn">GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set, so accounts cannot be connected.</p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {accounts.map((a) => (
          <li key={a.account} className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <strong>{a.account}</strong>{' '}
              <span className={a.connected ? 'text-text-muted' : 'text-warn'}>
                {a.connected ? (a.email ?? 'connected') : 'not connected'}
              </span>
            </span>
            {googleConfigured && (
              <span className="flex gap-2">
                <a className="btn" href={connectUrl(a.account)}>
                  {a.connected ? 'Reconnect' : 'Connect'}
                </a>
                {a.connected && (
                  <button className="btn" onClick={() => disconnect(a.account)}>
                    Disconnect
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {googleConfigured && (
        <form onSubmit={addAccount} className="mt-5 border-t border-white/10 pt-4">
          <span className="label">Add another Google account (a partner, a parent…)</span>
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="a short name, e.g. wife"
              value={name}
              onChange={(e) => setName(e.target.value)}
              pattern="[a-z0-9][a-z0-9\-]*"
              title="lowercase letters, digits and dashes"
              maxLength={30}
            />
            <button className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>
              Add &amp; sign in
            </button>
          </div>
          {error && <p className="mt-2 text-danger">{error}</p>}
          <p className="mt-2 text-sm text-text-muted">
            You will be sent to Google. Choose or add <em>their</em> account on the chooser, then Allow. Their password
            is never shared with this app; you can disconnect at any time.
          </p>
        </form>
      )}

      {googleConfigured && <PasteAddress redirectUri={redirectUri} onDone={onChanged} />}
    </section>
  );
}

/**
 * For installs reached over plain http on the home network: Google only redirects to https
 * addresses or localhost, so the final page may not load. The sign-in code is in that
 * page's address, and pasting it here finishes the job.
 */
function PasteAddress({ redirectUri, onDone }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);

  // If you are on a different address than the one Google will return to, the page will
  // most likely not load, so open the explanation by default.
  const redirectHost = new URL(redirectUri).host;
  const likelyNeeded = window.location.host !== redirectHost;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage({ kind: '', text: '' });
    try {
      const result = await api('/api/auth/google/complete', { method: 'POST', body: { url: text } });
      setMessage({ kind: 'ok', text: `Connected “${result.account}”${result.email ? ` (${result.email})` : ''}.` });
      setText('');
      await onDone();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-5 border-t border-white/10 pt-4" open={likelyNeeded}>
      <summary className="cursor-pointer text-text-muted">Signed in on Google but the page did not load?</summary>
      <form onSubmit={submit} className="mt-3">
        <p className="text-sm text-text-muted">
          Google sends you back to <code>{redirectUri}</code>. If you are not on that address, the page shows an error,
          and that is fine: <strong>copy the whole address from the browser&apos;s address bar</strong> and paste it
          below. It contains the one-time sign-in code, and it only works once.
        </p>
        <textarea
          className="field mt-2 min-h-24 font-mono text-sm"
          placeholder={`${redirectUri}?state=…&code=…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary mt-2" disabled={busy || !text.trim()}>
          {busy ? 'Finishing…' : 'Finish sign-in'}
        </button>
        {message.text && <p className={`mt-2 ${message.kind === 'ok' ? 'text-accent' : 'text-danger'}`}>{message.text}</p>}
      </form>
    </details>
  );
}
