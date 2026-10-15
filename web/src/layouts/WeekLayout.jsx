import Clock from '../components/Clock.jsx';
import WeekList from '../components/WeekList.jsx';

/**
 * A compact clock, then the current week as seven rows with plenty of room per day.
 * `above` / `below` are optional link buttons placed against the week.
 */
export default function WeekLayout({ screen, above, below }) {
  return (
    <>
      <Clock timezone={screen.timezone} clock={screen.clock} compact />
      {above}
      <WeekList
        screenId={screen.id}
        timezone={screen.timezone}
        clock={screen.clock}
        interactive={screen.mode === 'interactive'}
      />
      {below}
    </>
  );
}
