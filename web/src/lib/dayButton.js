/**
 * Props that make a date's box behave like a button (mouse, keyboard and screen readers),
 * but only in interactive mode. In kiosk mode nothing is added, so the box stays inert.
 *
 * @param {boolean} interactive
 * @param {string} label  e.g. "Thursday 15, show the full day"
 * @param {() => void} onOpen
 */
export function dayButtonProps(interactive, label, onOpen) {
  if (!interactive) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: onOpen,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    },
  };
}

/** Classes for a date's box in interactive mode: it looks clickable and shows a focus ring. */
export const CLICKABLE = 'cursor-pointer transition hover:ring-2 hover:ring-white/40 focus-visible:outline-2 focus-visible:outline-accent';
