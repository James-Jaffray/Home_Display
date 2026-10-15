import { useEffect } from 'react';

const CHECK_MS = 60_000;

/** The hashed asset files this page was actually loaded with, e.g. "/assets/index-AB12.js". */
function loadedAssets() {
  const files = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
    .map((el) => new URL(el.getAttribute('src') ?? el.getAttribute('href'), window.location.href).pathname)
    .filter((path) => path.startsWith('/assets/'));
  return [...new Set(files)].sort();
}

/**
 * Reload the page when a new version of the app has been deployed, so a TV that stays on
 * for months still picks up updates. Every minute it asks the server which web files it is
 * serving; if they are not the ones this page loaded, it reloads.
 *
 * The dev server has no hashed assets, so nothing is compared there. A server that is
 * briefly down is simply ignored: the page keeps showing what it has.
 */
export default function useAutoReload() {
  useEffect(() => {
    const mine = loadedAssets().join('|');
    if (!mine) return undefined;

    let cancelled = false;
    async function check() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const { webAssets } = await res.json();
        if (!cancelled && webAssets?.length && webAssets.join('|') !== mine) window.location.reload();
      } catch {
        // server restarting or network blip: try again next minute
      }
    }

    const timer = setInterval(check, CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
}
