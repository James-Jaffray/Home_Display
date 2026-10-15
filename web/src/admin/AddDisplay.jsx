import { useState } from 'react';
import { api } from './api.js';
import TimezoneSelect from './TimezoneSelect.jsx';

/**
 * Form for a new display: a name, a timezone, and optionally the look of an existing one.
 *
 * @param {object} props
 * @param {Array<{id: string, title: string}>} props.screens
 * @param {string} props.defaultTimezone
 * @param {(id: string) => Promise<void>} props.onCreated
 * @param {() => void} props.onCancel
 */
export default function AddDisplay({ screens, defaultTimezone, onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [copyFrom, setCopyFrom] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { title: title.trim(), timezone, ...(copyFrom ? { copyLookFrom: copyFrom } : {}) };
      const { id } = await api('/api/admin/screens', { method: 'POST', body });
      await onCreated(id);
    } catch (err) {
      setError(err.problems?.[0] ?? err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel">
      <h2 className="card-title">Add a display</h2>
      <p className="card-lede">Each display has its own calendars, photos, look and address.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Name</span>
          <input
            className="field"
            placeholder="e.g. Parents' kitchen"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          <span className="label">Timezone</span>
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </label>
        <label>
          <span className="label">Start with the look of</span>
          <select className="field" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Defaults</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary" disabled={busy || !title.trim()}>
          Create display
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
