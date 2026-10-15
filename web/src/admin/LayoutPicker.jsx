/**
 * Pick a layout from little diagrams. Each diagram is a rough sketch of the screen:
 * grey blocks are the clock, rows and cells are the calendar.
 */
const LAYOUTS = [
  { value: 'month-grid', label: 'Calendar grid', hint: 'Several weeks at a glance', wide: false },
  { value: 'portrait-week', label: 'One week', hint: 'A row per day, easy to read', wide: false },
  { value: 'landscape-split', label: 'Wide', hint: 'Clock and list beside the grid', wide: true },
  { value: 'portrait-agenda', label: 'List', hint: 'Today and the next few days', wide: false },
];

/** A cell of the sketch. */
function Block({ x, y, w, h, strong = false }) {
  return <rect x={x} y={y} width={w} height={h} rx="1.5" fill="currentColor" opacity={strong ? 0.85 : 0.28} />;
}

function Sketch({ layout }) {
  if (layout === 'landscape-split') {
    return (
      <svg viewBox="0 0 80 50" className="h-full w-full">
        <Block x="4" y="5" w="22" h="8" strong />
        <Block x="4" y="18" w="22" h="4" />
        <Block x="4" y="25" w="22" h="4" />
        <Block x="4" y="32" w="22" h="4" />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3, 4, 5, 6].map((col) => (
            <Block key={`${row}-${col}`} x={31 + col * 6.8} y={5 + row * 10.5} w="5.6" h="9" />
          )),
        )}
      </svg>
    );
  }
  if (layout === 'portrait-week') {
    return (
      <svg viewBox="0 0 50 80" className="h-full w-full">
        <Block x="12" y="4" w="26" h="8" strong />
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <g key={row}>
            <Block x="4" y={17 + row * 8.6} w="9" h="7" strong={row === 3} />
            <Block x="15" y={17 + row * 8.6} w="31" h="7" />
          </g>
        ))}
      </svg>
    );
  }
  if (layout === 'portrait-agenda') {
    return (
      <svg viewBox="0 0 50 80" className="h-full w-full">
        <Block x="9" y="5" w="32" h="14" strong />
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <g key={row}>
            <Block x="5" y={27 + row * 8.6} w="6" h="5" strong />
            <Block x="14" y={27 + row * 8.6} w={row % 2 ? 22 : 30} h="5" />
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 50 80" className="h-full w-full">
      <Block x="12" y="4" w="26" h="8" strong />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => (
          <Block key={`${row}-${col}`} x={4 + col * 6.3} y={17 + row * 15.5} w="5.4" h="14" strong={row === 0 && col === 3} />
        )),
      )}
    </svg>
  );
}

/**
 * @param {{value: string, onChange: (layout: string) => void}} props
 */
export default function LayoutPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LAYOUTS.map((layout) => (
        <button
          key={layout.value}
          type="button"
          role="radio"
          aria-checked={value === layout.value}
          onClick={() => onChange(layout.value)}
          className={`choice flex flex-col items-center gap-2 p-3 text-center ${value === layout.value ? 'choice-on' : ''}`}
        >
          <span className={`block text-text-muted ${layout.wide ? 'h-16 w-24' : 'h-20 w-14'}`}>
            <Sketch layout={layout.value} />
          </span>
          <span className="font-semibold">{layout.label}</span>
          <span className="text-xs text-text-muted">{layout.hint}</span>
        </button>
      ))}
    </div>
  );
}
