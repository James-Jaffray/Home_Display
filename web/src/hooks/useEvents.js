import { useEffect, useState } from 'react';

const REFRESH_MS = 30_000;

/**
 * Events for a screen, grouped by day, plus the health of each calendar.
 * Polls the server (which itself polls Google), and keeps showing the last good data if a
 * request fails, with `offline` set so the UI can say so.
 *
 * @param {string} screenId
 * @param {string} range  query string for the range, e.g. "weeks=4" or "days=5"
 * @returns {{agenda: object|null, offline: boolean}}
 */
export default function useEvents(screenId, range) {
  const [agenda, setAgenda] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/events?${range}`);
        if (!res.ok) throw new Error(`http ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setAgenda(data);
        setOffline(false);
      } catch {
        if (!cancelled) setOffline(true);
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screenId, range]);

  return { agenda, offline };
}
