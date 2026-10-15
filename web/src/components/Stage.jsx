/**
 * The box the whole display is drawn in. It does two jobs:
 *
 * 1. It is a size container, so everything inside sizes itself in `cqw`/`cqh` (percent of
 *    THIS box) rather than `vw`/`vh` (percent of the browser window). That is what lets
 *    the picture be turned without the layout breaking.
 * 2. It can rotate itself. A TV or stick that cannot rotate its own output can then show a
 *    portrait screen: turn the TV on its side and pick 90° or 270° in the dashboard.
 *
 * For 90° and 270° the box is made as wide as the window is tall (and the other way
 * round) and then swung into place, so after rotating it exactly fills the window.
 *
 * @param {{rotate: 0|90|180|270, children: import('react').ReactNode}} props
 */
export default function Stage({ rotate, children }) {
  return (
    <main className="fixed inset-0 overflow-hidden bg-surface">
      <div className="bg-surface" style={stageStyle(rotate)}>
        {children}
      </div>
    </main>
  );
}

/** @param {0|90|180|270} rotate */
function stageStyle(rotate) {
  const base = { position: 'absolute', containerType: 'size', overflow: 'hidden' };

  switch (rotate) {
    case 90:
      // Clockwise: hinge on the top-left corner, placed one window-width to the right.
      return { ...base, top: 0, left: '100vw', width: '100vh', height: '100vw', transformOrigin: 'top left', transform: 'rotate(90deg)' };
    case 270:
      // Counter-clockwise: hinge on the top-left corner, placed one window-height down.
      return { ...base, top: '100vh', left: 0, width: '100vh', height: '100vw', transformOrigin: 'top left', transform: 'rotate(-90deg)' };
    case 180:
      return { ...base, inset: 0, transform: 'rotate(180deg)' };
    default:
      return { ...base, inset: 0 };
  }
}
