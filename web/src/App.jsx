import { useEffect } from 'react';
import useScreen from './hooks/useScreen.js';
import Agenda from './components/Agenda.jsx';
import Clock from './components/Clock.jsx';
import MonthGrid from './components/MonthGrid.jsx';
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

  // portrait-week and landscape-split are not built yet; they show the list view.
  const isGrid = screen.layout === 'month-grid';

  return (
    <main className="relative h-full overflow-hidden bg-surface">
      <Slideshow screenId={screen.id} interval={screen.photoInterval} />
      {/* --fs is the font scale chosen in the dashboard; every text size multiplies by it. */}
      <div
        className="relative z-10 flex h-full flex-col items-center gap-[2.5vh] px-[3vw] py-[3vh] text-center"
        style={{ '--fs': screen.fontScale }}
      >
        <Clock timezone={screen.timezone} clock={screen.clock} compact={isGrid} />
        {isGrid ? (
          <MonthGrid
            screenId={screen.id}
            timezone={screen.timezone}
            clock={screen.clock}
            weeks={screen.weeks}
            weekStart={screen.weekStart}
          />
        ) : (
          <Agenda screenId={screen.id} timezone={screen.timezone} clock={screen.clock} />
        )}
      </div>
    </main>
  );
}
