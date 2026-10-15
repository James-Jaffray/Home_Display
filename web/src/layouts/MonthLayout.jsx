import Clock from '../components/Clock.jsx';
import MonthGrid from '../components/MonthGrid.jsx';

/**
 * A compact clock, then a calendar grid of several weeks starting with the current one.
 * `above` / `below` are optional link buttons placed against the grid.
 */
export default function MonthLayout({ screen, above, below }) {
  return (
    <>
      <Clock timezone={screen.timezone} clock={screen.clock} compact />
      {above}
      <MonthGrid
        screenId={screen.id}
        timezone={screen.timezone}
        clock={screen.clock}
        weeks={screen.weeks}
        weekStart={screen.weekStart}
        interactive={screen.mode === 'interactive'}
      />
      {below}
    </>
  );
}
