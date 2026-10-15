import { useRef, useState } from 'react';
import { api } from './api.js';

/**
 * The editing state of one display's settings form.
 *
 * - `draft` is what the form shows: the saved display with your unsaved edits on top.
 * - `change(patch)` shows the edit at once and saves it a moment later (quick edits to
 *   different fields are merged into one save).
 * - `keepLocal(patch)` shows an edit WITHOUT saving it, for a half-finished entry (an empty
 *   name, a link with no address yet) that must not be sent until it is valid.
 *
 * @param {object} screen  the display, from /api/admin/overview
 * @param {() => Promise<void>} onChanged  reload the overview after a save
 */
export default function useDisplayForm(screen, onChanged) {
  // Edits made in the form but not yet confirmed by the server.
  const [edits, setEdits] = useState({});
  const [save, setSave] = useState({ state: '', text: '' });
  const timer = useRef(null);
  // Changes made since the last save; merged so quick edits to different fields all go out.
  const pending = useRef({});

  const draft = { ...screen, ...edits };

  function change(patch) {
    setEdits((e) => ({ ...e, ...patch }));
    setSave({ state: 'saving', text: 'Saving…' });
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const toSend = pending.current;
      pending.current = {};
      try {
        await api(`/api/admin/screens/${screen.id}`, { method: 'PATCH', body: toSend });
        setSave({ state: 'saved', text: 'Saved' });
        await onChanged();
        // The refreshed `screen` now holds these values; drop the temporary edits.
        setEdits((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !(key in toSend))));
      } catch (err) {
        setSave({ state: 'error', text: `Not saved: ${err.problems?.[0] ?? err.message}` });
      }
    }, 350);
  }

  function keepLocal(patch) {
    setEdits((e) => ({ ...e, ...patch }));
  }

  return {
    draft,
    // Link buttons, the searchbar and click-a-date only exist in interactive mode.
    interactive: draft.mode === 'interactive',
    save,
    change,
    keepLocal,
  };
}
