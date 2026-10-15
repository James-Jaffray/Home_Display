import AccessSection from './sections/AccessSection.jsx';
import CalendarsSection from './sections/CalendarsSection.jsx';
import LinksSection from './sections/LinksSection.jsx';
import LookSection from './sections/LookSection.jsx';
import PhotosSection from './sections/PhotosSection.jsx';
import useDisplayForm from './useDisplayForm.js';

/**
 * One display's settings, one dashboard tab at a time. It holds the form state (see
 * useDisplayForm) and hands it to the section for the chosen tab, so edits survive switching
 * tabs and are saved automatically.
 *
 * @param {object} props
 * @param {'look'|'calendars'|'links'|'photos'|'access'} props.section  which tab is open
 * @param {object} props.screen  from /api/admin/overview
 * @param {Array} props.calendars  every calendar the server knows
 * @param {Array} props.accounts
 * @param {string} props.publicBaseUrl
 * @param {Record<string, string>} props.statusLabel
 * @param {() => Promise<void>} props.onChanged  reload the overview after a change
 * @param {() => Promise<void>} props.onDeleted  called after this display was deleted
 */
export default function DisplaySettings({
  section,
  screen,
  calendars,
  accounts,
  publicBaseUrl,
  statusLabel,
  onChanged,
  onDeleted,
}) {
  const form = useDisplayForm(screen, onChanged);

  switch (section) {
    case 'calendars':
      return (
        <CalendarsSection
          form={form}
          screen={screen}
          calendars={calendars}
          accounts={accounts}
          statusLabel={statusLabel}
          onChanged={onChanged}
        />
      );
    case 'links':
      return <LinksSection form={form} screen={screen} />;
    case 'photos':
      return <PhotosSection form={form} screen={screen} onChanged={onChanged} />;
    case 'access':
      return <AccessSection screen={screen} publicBaseUrl={publicBaseUrl} onChanged={onChanged} onDeleted={onDeleted} />;
    default:
      return <LookSection form={form} />;
  }
}
