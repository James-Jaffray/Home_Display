import { useMemo } from 'react';
import { timezoneNames } from './timezones.js';

/** "GMT-6" for a timezone right now, or '' if the browser cannot say. */
function offsetLabel(zone) {
  try {
    return (
      new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

// Computed once: asking the browser for ~400 offsets is quick, but there is no reason to repeat it.
let cachedGroups = null;

function buildGroups() {
  if (cachedGroups) return cachedGroups;
  const regions = new Map();
  for (const zone of new Set([...timezoneNames(), 'UTC'])) {
    const [region, ...rest] = zone.split('/');
    const key = rest.length ? region : 'Other';
    if (!regions.has(key)) regions.set(key, []);
    const city = rest.length ? rest.join(' / ').replaceAll('_', ' ') : zone;
    regions.get(key).push({ zone, label: `${city} (${offsetLabel(zone) || 'UTC'})` });
  }
  cachedGroups = [...regions.entries()]
    .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
    .map(([region, zones]) => ({ region, zones: zones.sort((a, b) => a.label.localeCompare(b.label)) }));
  return cachedGroups;
}

/**
 * Every timezone the browser knows, grouped by region (America, Europe, ...), each with its
 * current offset from UTC. A plain dropdown, so all of them are always one click away.
 *
 * @param {{value: string, onChange: (zone: string) => void, id?: string}} props
 */
export default function TimezoneSelect({ value, onChange, id }) {
  const groups = useMemo(() => buildGroups(), []);
  const known = groups.some((group) => group.zones.some((z) => z.zone === value));

  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {/* A zone from config.yaml that this browser does not list still shows, not a blank. */}
      {!known && <option value={value}>{value}</option>}
      {groups.map(({ region, zones }) => (
        <optgroup key={region} label={region}>
          {zones.map(({ zone, label }) => (
            <option key={zone} value={zone}>
              {label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
