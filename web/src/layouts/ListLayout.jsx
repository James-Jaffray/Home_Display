import Agenda from '../components/Agenda.jsx';
import Clock from '../components/Clock.jsx';

/**
 * Big clock on top, then Today and the next few days as a list.
 * `above` / `below` are optional link buttons placed against the list.
 */
export default function ListLayout({ screen, above, below }) {
  return (
    <>
      <Clock timezone={screen.timezone} clock={screen.clock} />
      {above}
      <Agenda screenId={screen.id} timezone={screen.timezone} clock={screen.clock} />
      {below}
    </>
  );
}
