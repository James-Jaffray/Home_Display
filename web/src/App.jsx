import { useEffect } from 'react';
import useAutoReload from './hooks/useAutoReload.js';
import useScreen from './hooks/useScreen.js';
import useScreenId from './hooks/useScreenId.js';
import Slideshow from './components/Slideshow.jsx';
import Stage from './components/Stage.jsx';
import DisplayLayout from './layouts/DisplayLayout.jsx';

/**
 * The wall display: a view-only page for one display, at /display/<id>.
 * It has no controls and no login; everything it shows is set in the dashboard.
 */
export default function App() {
  const screenId = useScreenId();
  const { screen, error } = useScreen(screenId);
  useAutoReload();

  useEffect(() => {
    if (screen) document.title = screen.title;
  }, [screen]);

  // Nothing loaded yet: show why, or a blank page while the first request is in flight.
  if (!screen) {
    if (!error) return <main className="h-full bg-surface" />;
    return (
      <main className="flex h-full items-center justify-center bg-surface p-8 text-center">
        <p className="text-3xl text-text-muted">
          {error === 'not-found' && `No screen called “${screenId}”.`}
          {error === 'forbidden' && 'This display needs its access token. Open the address shown on the dashboard.'}
          {error === 'server' && 'Server unreachable, retrying…'}
        </p>
      </main>
    );
  }

  return (
    <Stage rotate={screen.rotate}>
      <Slideshow screenId={screen.id} interval={screen.photoInterval} />
      <DisplayLayout screen={screen} />
    </Stage>
  );
}
