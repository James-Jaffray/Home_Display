import { PresetIcon } from '../lib/icons.jsx';
import { withToken } from '../lib/token.js';

/**
 * Round icon buttons that open other websites. A display has at most six; the dashboard
 * chooses the icons and where they sit (above/below the calendar as a row, or beside it as
 * a column).
 *
 * @param {object} props
 * @param {Array<{title: string, url: string, icon: {preset?: string, imageUrl?: string}}>} props.links
 * @param {'row'|'column'} props.direction
 */
export default function LinkButtons({ links, direction }) {
  if (links.length === 0) return null;

  return (
    <nav
      aria-label="Links"
      className={[
        'flex shrink-0 items-center justify-center gap-[2cqw]',
        direction === 'column' ? 'flex-col justify-center gap-[2cqh]' : 'flex-row flex-wrap',
      ].join(' ')}
    >
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          title={link.title}
          aria-label={link.title}
          rel="noopener noreferrer"
          className="flex size-[min(9cqw,7cqh)] items-center justify-center overflow-hidden rounded-full border border-white/15 bg-surface-raised/85 text-text shadow-lg transition hover:scale-110 hover:border-accent hover:text-accent focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {link.icon.imageUrl ? (
            <img src={withToken(link.icon.imageUrl)} alt="" className="size-full object-cover" />
          ) : (
            <PresetIcon name={link.icon.preset} className="size-[58%]" />
          )}
        </a>
      ))}
    </nav>
  );
}
