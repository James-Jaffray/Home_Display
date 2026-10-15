import { useEffect, useState } from 'react';

/** The display id in the address bar: /display/<id> (or an old-style /<id>). */
function idFromUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  return parts[0] === 'display' ? (parts[1] ?? '') : (parts[0] ?? '');
}

/**
 * Which display this page is showing. A bare /display has no id, so ask the server for the
 * default one and tidy the address bar to /display/<id> (the server redirects too; this
 * covers the dev server).
 *
 * @returns {string} the id, or '' while the default is still being looked up
 */
export default function useScreenId() {
  const [screenId, setScreenId] = useState(idFromUrl);

  useEffect(() => {
    if (screenId) return undefined;
    let cancelled = false;
    fetch('/api/default-screen')
      .then((res) => res.json())
      .then(({ id }) => {
        if (cancelled || !id) return;
        // Keep ?k=<token> if the address had one.
        window.history.replaceState(null, '', `/display/${encodeURIComponent(id)}${window.location.search}`);
        setScreenId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [screenId]);

  return screenId;
}
