import { useState } from 'react';
import { UiIcon } from '../../lib/icons.jsx';
import { api } from '../api.js';

/**
 * How a display is reached: its addresses, and the switch that requires an access token.
 * Also where a dashboard-made display can be deleted.
 *
 * @param {object} props
 * @param {object} props.screen  from /api/admin/overview
 * @param {string} props.publicBaseUrl  the address this install is meant to be reached at
 * @param {() => Promise<void>} props.onChanged  reload the overview
 * @param {() => Promise<void>} props.onDeleted  called after the display was deleted
 */
export default function AccessSection({ screen, publicBaseUrl, onChanged, onDeleted }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const path = `/display/${screen.id}${screen.token ? `?k=${encodeURIComponent(screen.token)}` : ''}`;
  const here = window.location.origin;
  // A localhost "public" address is just the default; only show a real one.
  const publicHost = new URL(publicBaseUrl).hostname;
  const showPublic = !['localhost', '127.0.0.1', '::1'].includes(publicHost) && publicBaseUrl !== here;
  const addresses = [
    { label: showPublic ? 'On this network' : 'Address', url: `${here}${path}` },
    ...(showPublic ? [{ label: 'From outside', url: `${publicBaseUrl}${path}` }] : []),
  ];
  const fromConfig = screen.tokenSource === 'config';

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard needs https or localhost; the address is selectable text anyway.
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the display "${screen.title}"? Its photos stay on disk.`)) return;
    try {
      await api(`/api/admin/screens/${screen.id}`, { method: 'DELETE' });
      await onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <section className="panel">
        <h2 className="card-title">Address</h2>
        <p className="card-lede">Open this on the TV or Raspberry Pi. The page is view-only: no controls and no login.</p>

        <ul className="mt-4 flex flex-col gap-3">
          {addresses.map(({ label, url }) => (
            <li key={label}>
              <span className="label">{label}</span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all py-2">{url}</code>
                <button className="btn" onClick={() => copy(url)}>
                  <UiIcon name="copy" className="size-4" />
                  {copied === url ? 'Copied' : 'Copy'}
                </button>
                <a className="btn" href={url} target="_blank" rel="noreferrer">
                  <UiIcon name="external" className="size-4" />
                  Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="card-title">Require an access token</h2>
            <p className="card-lede">
              {screen.token
                ? 'On: this display only opens with the token in its address, at home or away.'
                : 'Off: it opens from your home network. From outside (a tunnel or port-forward) it is refused until you turn this on.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(screen.token)}
            aria-label="Require an access token"
            className="toggle"
            disabled={busy || fromConfig}
            onClick={() =>
              run(() =>
                screen.token
                  ? api(`/api/admin/screens/${screen.id}/token`, { method: 'DELETE' })
                  : api(`/api/admin/screens/${screen.id}/token`, { method: 'POST', body: {} }),
              )
            }
          />
        </div>

        {screen.token && !fromConfig && (
          <button
            className="btn mt-4"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Make a new token? Screens using the old address will stop until you update them.')) {
                run(() => api(`/api/admin/screens/${screen.id}/token`, { method: 'POST', body: {} }));
              }
            }}
          >
            Make a new token
          </button>
        )}
        {fromConfig && <p className="hint mt-3">This token is set in config.yaml, so it is changed there.</p>}
        {error && <p className="mt-3 text-danger">{error}</p>}
      </section>

      {screen.removable && (
        <section className="panel">
          <h2 className="card-title">Delete this display</h2>
          <p className="card-lede">Removes its settings and links. Photo files stay on disk.</p>
          <button className="btn btn-danger mt-4" onClick={remove}>
            <UiIcon name="trash" className="size-4" />
            Delete display
          </button>
        </section>
      )}
    </>
  );
}
