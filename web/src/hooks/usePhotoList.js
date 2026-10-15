import { useEffect, useState } from 'react';
import { withToken } from '../lib/token.js';

const REFRESH_MS = 10 * 60_000;

/**
 * The list of photo URLs for a screen, refreshed every 10 minutes so new uploads appear.
 * Failures keep the previous list.
 *
 * @param {string} screenId
 * @returns {string[]}
 */
export default function usePhotoList(screenId) {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(withToken(`/api/screens/${encodeURIComponent(screenId)}/photos`));
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        // Photo addresses carry the display token too (the browser loads them as images).
        const urls = body.photos.map(withToken);
        // Same list again: keep the old array so the slideshow doesn't restart.
        setPhotos((prev) => (prev.join('|') === urls.join('|') ? prev : urls));
      } catch {
        // keep the current list
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screenId]);

  return photos;
}
