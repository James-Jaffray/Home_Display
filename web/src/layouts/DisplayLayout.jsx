import LinkButtons from '../components/LinkButtons.jsx';
import SearchBox from '../components/SearchBox.jsx';
import ListLayout from './ListLayout.jsx';
import MonthLayout from './MonthLayout.jsx';
import SplitLayout from './SplitLayout.jsx';
import WeekLayout from './WeekLayout.jsx';

/** The layout names a display can use, mapped to the component that draws them. */
const LAYOUTS = {
  'month-grid': MonthLayout,
  'portrait-week': WeekLayout,
  'landscape-split': SplitLayout,
  'portrait-agenda': ListLayout,
};

/**
 * The frame every layout sits in: padding, the font scale chosen in the dashboard, the
 * link buttons, and the optional search bar. The layout itself draws the clock and calendar.
 *
 * Link buttons go in one of four places. "Above" and "below" (and the search bar's two
 * places) are handed to the layout, so they sit directly against its calendar; "left" and
 * "right" are columns beside everything. If both land above or below, the search bar is the
 * one next to the calendar.
 *
 * @param {{screen: object}} props  a display, from /api/screens/:id
 */
export default function DisplayLayout({ screen }) {
  const Layout = LAYOUTS[screen.layout] ?? ListLayout;
  const position = screen.linksPosition;

  const row = <LinkButtons links={screen.links} direction="row" />;
  const column = <LinkButtons links={screen.links} direction="column" />;
  const search = screen.search ? <SearchBox /> : null;

  const above = (
    <>
      {position === 'top' && row}
      {screen.searchPosition === 'above' && search}
    </>
  );
  const below = (
    <>
      {screen.searchPosition === 'below' && search}
      {position === 'bottom' && row}
    </>
  );

  return (
    <div
      className="relative z-10 flex h-full flex-col items-center px-[3cqw] py-[3cqh] text-center"
      // --fs is the font scale chosen in the dashboard; every text size multiplies by it.
      style={{ '--fs': screen.fontScale }}
    >
      <div className="flex min-h-0 w-full flex-1 gap-[2cqw]">
        {position === 'left' && column}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-[2.5cqh]">
          <Layout screen={screen} above={above} below={below} />
        </div>
        {position === 'right' && column}
      </div>
    </div>
  );
}
