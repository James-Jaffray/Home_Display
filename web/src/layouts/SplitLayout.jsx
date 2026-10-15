import Agenda from '../components/Agenda.jsx';
import Clock from '../components/Clock.jsx';
import MonthGrid from '../components/MonthGrid.jsx';

/**
 * For wide screens (a landscape TV or a desktop browser): on the left the clock and the
 * next few days as a list, on the right the calendar grid.
 * `above` / `below` are optional link buttons placed against the grid on the right.
 */
export default function SplitLayout({ screen, above, below }) {
  return (
    <div className="flex min-h-0 w-full flex-1 gap-[2cqw]">
      <div className="flex min-h-0 w-[34%] shrink-0 flex-col items-center gap-[2.5cqh]">
        <Clock timezone={screen.timezone} clock={screen.clock} compact />
        <Agenda screenId={screen.id} timezone={screen.timezone} clock={screen.clock} days={3} showStatus={false} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-[2.5cqh]">
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
      </div>
    </div>
  );
}
