import { UiIcon } from '../lib/icons.jsx';

/** The sections of the dashboard. All but Accounts edit the display chosen in the header. */
const TABS = [
  { id: 'look', label: 'Look', icon: 'look' },
  { id: 'calendars', label: 'Calendars', icon: 'calendars' },
  { id: 'links', label: 'Links', icon: 'links' },
  { id: 'photos', label: 'Photos', icon: 'photos' },
  { id: 'access', label: 'Access', icon: 'access' },
  { id: 'accounts', label: 'Accounts', icon: 'accounts' },
];

/**
 * @param {{current: string, onChange: (id: string) => void}} props
 */
export default function Tabs({ current, onChange }) {
  return (
    <div role="tablist" aria-label="Dashboard sections" className="tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={current === tab.id}
          className={`tab ${current === tab.id ? 'tab-on' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <UiIcon name={tab.icon} className="size-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
