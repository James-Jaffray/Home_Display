import LayoutPicker from '../LayoutPicker.jsx';
import SectionHeader from '../SectionHeader.jsx';
import Segmented from '../Segmented.jsx';
import TimezoneSelect from '../TimezoneSelect.jsx';

const ROTATIONS = [
  [0, 'None'],
  [90, '90° clockwise'],
  [270, '90° counter-clockwise'],
  [180, '180°'],
];

const SEARCH_POSITIONS = [
  ['above', 'Above the calendar'],
  ['below', 'Below the calendar'],
];

/**
 * How a display looks and behaves: mode, layout, name and timezone, appearance, rotation
 * and the searchbar. The searchbar is greyed out in kiosk mode.
 *
 * @param {{form: ReturnType<import('../useDisplayForm.js').default>}} props
 */
export default function LookSection({ form }) {
  const { draft, interactive, change, keepLocal, save } = form;
  // The week settings only matter to the layouts that show a grid of weeks.
  const showWeeks = draft.layout === 'month-grid' || draft.layout === 'landscape-split';

  return (
    <>
      <section className="panel py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="card-title">Interactive mode</h2>
            <p className="hint">
              {interactive
                ? 'On: link buttons, searchbar and clickable dates, for a browser homepage.'
                : 'Off: kiosk. A view-only wall screen with no links or searchbar.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={interactive}
            aria-label="Interactive mode"
            className="toggle"
            onClick={() => change({ mode: interactive ? 'kiosk' : 'interactive' })}
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="Layout" lede="How the clock and calendar are arranged." save={save} />
        <div className="mt-4">
          <LayoutPicker value={draft.layout} onChange={(layout) => change({ layout })} />
        </div>
      </section>

      <section className="panel">
        <h2 className="card-title">Basics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Name</span>
            <input
              className="field"
              value={draft.title}
              maxLength={60}
              onChange={(e) => {
                // An empty name is not valid; keep typing locally and only save real names.
                if (e.target.value.trim()) change({ title: e.target.value });
                else keepLocal({ title: e.target.value });
              }}
            />
          </label>
          <label>
            <span className="label">Timezone</span>
            <TimezoneSelect value={draft.timezone} onChange={(timezone) => change({ timezone })} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 className="card-title">Appearance</h2>
        <div className="mt-4 grid gap-5">
          <div>
            <span className="label">Clock</span>
            <Segmented
              label="Clock"
              options={[
                ['12', '12-hour'],
                ['24', '24-hour'],
              ]}
              value={draft.clock}
              onChange={(clock) => change({ clock })}
            />
          </div>

          {showWeeks && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <span className="label">Weeks shown</span>
                <Segmented
                  label="Weeks shown"
                  options={[1, 2, 3, 4, 5, 6].map((n) => [n, String(n)])}
                  value={draft.weeks}
                  onChange={(weeks) => change({ weeks })}
                />
              </div>
              <div>
                <span className="label">Week starts on</span>
                <Segmented
                  label="Week starts on"
                  options={[
                    ['sunday', 'Sunday'],
                    ['monday', 'Monday'],
                  ]}
                  value={draft.weekStart}
                  onChange={(weekStart) => change({ weekStart })}
                />
              </div>
            </div>
          )}

          <label>
            <span className="label">Text size: {Math.round(draft.fontScale * 100)}%</span>
            <input
              className="w-full accent-accent"
              type="range"
              min="0.7"
              max="1.6"
              step="0.05"
              value={draft.fontScale}
              onChange={(e) => change({ fontScale: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 className="card-title">Screen and browser</h2>
        <div className="mt-4 grid gap-5">
          <div>
            <span className="label">Rotate the picture</span>
            <Segmented
              label="Rotate the picture"
              options={ROTATIONS}
              value={draft.rotate}
              onChange={(rotate) => change({ rotate })}
            />
            <p className="hint mt-2">
              For a TV or stick that cannot rotate its own output: turn the TV on its side and rotate the picture here.
            </p>
          </div>

          <div className={interactive ? '' : 'opacity-45'}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="font-medium">Show searchbar</span>
                <p className="hint">
                  {interactive
                    ? 'A Google search bar, handy when this display is your browser homepage.'
                    : 'Off in kiosk mode. Switch this display to interactive to use it.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={interactive && draft.search}
                aria-label="Show searchbar"
                className="toggle"
                disabled={!interactive}
                onClick={() => change({ search: !draft.search })}
              />
            </div>
            {interactive && draft.search && (
              <div className="mt-3">
                <Segmented
                  label="Where the searchbar goes"
                  options={SEARCH_POSITIONS}
                  value={draft.searchPosition}
                  onChange={(searchPosition) => change({ searchPosition })}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
