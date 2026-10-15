import { api } from '../api.js';
import CalendarPicker from '../CalendarPicker.jsx';
import SectionHeader from '../SectionHeader.jsx';

/**
 * Which calendars this display shows.
 *
 * @param {object} props
 * @param {ReturnType<import('../useDisplayForm.js').default>} props.form
 * @param {object} props.screen
 * @param {Array} props.calendars  every calendar the server knows
 * @param {Array} props.accounts
 * @param {Record<string, string>} props.statusLabel
 * @param {() => Promise<void>} props.onChanged
 */
export default function CalendarsSection({ form, screen, calendars, accounts, statusLabel, onChanged }) {
  const { draft, change, save } = form;

  function toggleCalendar(calId, on) {
    const next = on ? [...draft.calendars, calId] : draft.calendars.filter((c) => c !== calId);
    change({ calendars: next });
  }

  /**
   * A switch in the calendar list. Calendars the server already knows are just shown or
   * hidden on this display; a new one is created (and shown) in one step.
   */
  async function setGoogleCalendar(account, choice, on, match) {
    if (match) {
      toggleCalendar(match.id, on);
      return;
    }
    if (!on) return;
    await api('/api/admin/calendars', {
      method: 'POST',
      body: { account, calendarId: choice.calendarId, label: choice.label, color: choice.color, screens: [screen.id] },
    });
    await onChanged();
  }

  return (
    <section className="panel">
      <SectionHeader
        title={`Calendars on ${draft.title}`}
        lede="Pick whose calendars to choose from, then switch on the ones this display should show."
        save={save}
      />
      <div className="mt-4">
        <CalendarPicker
          accounts={accounts}
          known={calendars}
          shownIds={draft.calendars}
          statusLabel={statusLabel}
          onToggle={setGoogleCalendar}
        />
      </div>
    </section>
  );
}
