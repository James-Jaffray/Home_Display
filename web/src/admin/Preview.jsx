import { useEffect, useRef, useState } from 'react';

const SHAPES = [
  ['auto', 'Auto'],
  ['portrait', 'Portrait'],
  ['landscape', 'Landscape'],
];

/**
 * A live, scaled-down copy of the display, so you see a change as you make it. It is the
 * real display page in a frame, sized like a 1080x1920 (or 1920x1080) TV and shrunk to fit.
 *
 * It reloads whenever a setting that affects the picture changes.
 *
 * @param {{screen: object}} props  a display, from /api/admin/overview
 */
export default function Preview({ screen }) {
  const box = useRef(null);
  const [boxWidth, setBoxWidth] = useState(320);
  const [shape, setShape] = useState('auto');

  // Track how wide the preview area is, so the scaled screen always fits.
  useEffect(() => {
    if (!box.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  // A TV turned on its side (rotation 90/270) is a landscape window showing a portrait picture.
  const turnedOnSide = screen.rotate === 90 || screen.rotate === 270;
  const autoLandscape = turnedOnSide || screen.layout === 'landscape-split';
  const landscape = shape === 'auto' ? autoLandscape : shape === 'landscape';

  const width = landscape ? 1920 : 1080;
  const height = landscape ? 1080 : 1920;
  const scale = boxWidth / width;

  // Anything that changes what the display shows changes this key, which reloads the frame.
  const version = JSON.stringify([
    screen.id,
    screen.title,
    screen.timezone,
    screen.layout,
    screen.weeks,
    screen.weekStart,
    screen.clock,
    screen.fontScale,
    screen.rotate,
    screen.mode,
    screen.search,
    screen.searchPosition,
    screen.linksPosition,
    screen.links,
    screen.calendars,
    screen.photos.map((p) => p.name),
    screen.token,
  ]);
  const src = `/display/${encodeURIComponent(screen.id)}${screen.token ? `?k=${encodeURIComponent(screen.token)}` : ''}`;

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="card-title">Live preview</h2>
        <div className="flex gap-1" role="radiogroup" aria-label="Preview shape">
          {SHAPES.map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={shape === value}
              className={`choice btn-small ${shape === value ? 'choice-on' : ''}`}
              onClick={() => setShape(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="device mt-4">
        <div ref={box} className="device-screen" style={{ height: boxWidth * (height / width) }}>
          <iframe
            key={version}
            title={`Preview of ${screen.title}`}
            src={src}
            tabIndex={-1}
            style={{
              width,
              height,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      <p className="hint mt-3">What this display looks like right now, at {landscape ? '1920×1080' : '1080×1920'}.</p>
    </section>
  );
}
