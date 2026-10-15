import { useEffect, useState } from 'react';

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
        const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/photos`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        // Same list again: keep the old array so the slideshow doesn't restart.
        setPhotos((prev) => (prev.join('|') === body.photos.join('|') ? prev : body.photos));
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
