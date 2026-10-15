import { UiIcon } from '../lib/icons.jsx';

/**
 * The bar across the top: the product name, which display you are editing, and the
 * shortcuts to open it or log out.
 *
 * @param {object} props
 * @param {Array<{id: string, title: string, token: string|null}>} props.screens
 * @param {string} props.selectedId
 * @param {(id: string) => void} props.onSelect
 * @param {() => void} props.onAdd
 * @param {() => void} props.onLogout
 */
export default function Header({ screens, selectedId, onSelect, onAdd, onLogout }) {
  const selected = screens.find((s) => s.id === selectedId) ?? screens[0];
  const openUrl = `/display/${selected.id}${selected.token ? `?k=${encodeURIComponent(selected.token)}` : ''}`;

  return (
    <header className="admin-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="brand-mark">
            <UiIcon name="brand" className="size-5" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:block">Home-Display</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Display you are editing</span>
            <select className="field" value={selected.id} onChange={(e) => onSelect(e.target.value)}>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={onAdd} aria-label="Add a display" title="Add a display">
            <UiIcon name="plus" className="size-4" />
            <span className="hidden md:inline">Add display</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a className="btn" href={openUrl} target="_blank" rel="noreferrer">
            <UiIcon name="external" className="size-4" />
            <span className="hidden sm:inline">Open display</span>
          </a>
          <button className="btn" onClick={onLogout} aria-label="Log out" title="Log out">
            <UiIcon name="logout" className="size-4" />
            <span className="hidden md:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
