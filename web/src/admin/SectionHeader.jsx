/**
 * The top of a dashboard card: a title, a one-line explanation, and (when the form is
 * saving) a small "Saving… / Saved" pill.
 *
 * @param {{title: string, lede?: string, save?: {state: string, text: string}}} props
 */
export default function SectionHeader({ title, lede, save }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="card-title">{title}</h2>
        {lede && <p className="card-lede">{lede}</p>}
      </div>
      {save?.text && (
        <span className="status-pill" data-state={save.state} role="status">
          {save.text}
        </span>
      )}
    </div>
  );
}
