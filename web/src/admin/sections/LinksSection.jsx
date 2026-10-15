import LinksEditor from '../LinksEditor.jsx';
import SectionHeader from '../SectionHeader.jsx';

/**
 * The display's round link buttons. Greyed out and untouchable in kiosk mode (they do not
 * show there), with a shortcut to switch the display to interactive.
 *
 * @param {object} props
 * @param {ReturnType<import('../useDisplayForm.js').default>} props.form
 * @param {object} props.screen
 */
export default function LinksSection({ form, screen }) {
  const { draft, interactive, change, keepLocal, save } = form;

  return (
    <section className="panel">
      <SectionHeader
        title="Link buttons"
        lede="Up to six round buttons that open other websites, only on this display."
        save={save}
      />

      {!interactive && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface p-3">
          <p className="hint">
            This display is a <strong>kiosk</strong>, so link buttons are off. Your links are kept and come back in
            interactive mode.
          </p>
          <button className="btn btn-primary" onClick={() => change({ mode: 'interactive' })}>
            Switch to interactive
          </button>
        </div>
      )}

      {/* inert: not clickable, not focusable, ignored by screen readers while it is off */}
      <div className={`mt-4 ${interactive ? '' : 'pointer-events-none opacity-45'}`} inert={!interactive}>
        <LinksEditor
          screenId={screen.id}
          token={screen.token}
          links={draft.links}
          position={draft.linksPosition}
          // Valid lists are saved; a half-typed one stays on screen until it is complete.
          onLinks={(links, allValid) => (allValid ? change({ links }) : keepLocal({ links }))}
          onPosition={(linksPosition) => change({ linksPosition })}
        />
      </div>
    </section>
  );
}
