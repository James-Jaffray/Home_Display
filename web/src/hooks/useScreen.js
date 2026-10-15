import { useEffect, useState } from 'react';

const REFRESH_MS = 60_000;

/**
 * Loads a screen's display settings from the server and re-checks every minute.
 * If the server blips, the screen already on display keeps going.
 *
 * @param {string} screenId
 * @returns {{screen: object|null, error: 'not-found'|'server'|null}}
 */
export default function useScreen(screenId) {
  const [screen, setScreen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}`);
        if (res.status === 404) throw new Error('not-found');
        if (!res.ok) throw new Error('server');
        const data = await res.json();
        if (cancelled) return;
        setScreen(data);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message === 'not-found' ? 'not-found' : 'server');
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screenId]);

  return { screen, error };
}
