import { useEffect } from 'react';
import useScreen from './hooks/useScreen.js';
import Clock from './components/Clock.jsx';
import Slideshow from './components/Slideshow.jsx';

// The first path segment is the screen id (the server redirects "/" to the default).
const screenId = decodeURIComponent(window.location.pathname.split('/')[1] ?? '');

export default function App() {
  const { screen, error } = useScreen(screenId);

  useEffect(() => {
    if (screen) document.title = screen.title;
  }, [screen]);

  // Nothing loaded yet: show why, or a blank page while the first request is in flight.
  if (!screen) {
    if (!error) return <main className="h-full bg-surface" />;
    return (
      <main className="flex h-full items-center justify-center bg-surface p-8 text-center">
        <p className="text-3xl text-text-muted">
          {error === 'not-found' ? `No screen called “${screenId}”.` : 'Server unreachable, retrying…'}
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-full overflow-hidden bg-surface">
      <Slideshow screenId={screen.id} interval={screen.photoInterval} />
      <div className="relative z-10 flex h-full flex-col items-center px-[6vw] pt-[8vh] text-center">
        <Clock timezone={screen.timezone} clock={screen.clock} />
      </div>
    </main>
  );
}
