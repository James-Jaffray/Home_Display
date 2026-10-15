import { useEffect, useState } from 'react';
import usePhotoList from '../hooks/usePhotoList.js';

/**
 * Crossfading photo background. Only the next photo is preloaded (Pi Chromium memory).
 * With no photos, or on any error, it shows the gradient fallback instead of breaking.
 * @param {{screenId: string, interval: number}} props
 */
export default function Slideshow({ screenId, interval }) {
  const photos = usePhotoList(screenId);
  const [tick, setTick] = useState(0);
  // Random start so a reboot doesn't always open on the same photo.
  const [start] = useState(() => Math.random());
  // `shown` is what is on screen; `behind` stays underneath while the new one fades in.
  const [layers, setLayers] = useState({ shown: null, behind: null });

  const current = photos.length ? photos[(Math.floor(start * photos.length) + tick) % photos.length] : null;

  useEffect(() => {
    if (!current) return undefined;
    const url = current;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLayers((l) => (l.shown === url ? l : { shown: url, behind: l.shown }));
    };
    img.onerror = () => {
      // Unreadable file: skip to the next one rather than stalling.
      if (!cancelled && photos.length > 1) setTick((t) => t + 1);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [current, photos.length]);

  useEffect(() => {
    if (photos.length < 2) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), interval * 1000);
    return () => clearInterval(timer);
  }, [photos.length, interval]);

  const show = photos.length > 0 ? layers : { shown: null, behind: null };

  return (
    <div className="absolute inset-0 bg-linear-to-br from-surface-raised to-surface">
      {show.behind && <Photo key={`b-${show.behind}`} url={show.behind} />}
      {show.shown && <Photo key={show.shown} url={show.shown} fade />}
      {/* Scrim keeps the clock and (later) agenda legible over any photo. */}
      <div className="absolute inset-0 bg-linear-to-b from-surface/70 via-surface/20 to-surface/70" />
    </div>
  );
}

function Photo({ url, fade = false }) {
  return (
    <div
      className={`absolute inset-0 bg-cover bg-center ${fade ? 'animate-photo-in' : ''}`}
      style={{ backgroundImage: `url("${url}")` }}
    />
  );
}
