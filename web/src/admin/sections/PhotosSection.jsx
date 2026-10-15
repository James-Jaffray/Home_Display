import Photos from '../Photos.jsx';
import SectionHeader from '../SectionHeader.jsx';

/**
 * The display's background photos and how long each one stays.
 *
 * @param {object} props
 * @param {ReturnType<import('../useDisplayForm.js').default>} props.form
 * @param {object} props.screen
 * @param {() => Promise<void>} props.onChanged
 */
export default function PhotosSection({ form, screen, onChanged }) {
  const { draft, change, save } = form;

  return (
    <section className="panel">
      <SectionHeader
        title="Background photos"
        lede="They fade one into the next behind the clock and calendar."
        save={save}
      />
      <label className="mt-4 mb-5 block">
        <span className="label">Time on each photo: {draft.photoInterval} seconds</span>
        <input
          className="w-full accent-accent"
          type="range"
          min="5"
          max="300"
          step="5"
          value={draft.photoInterval}
          onChange={(e) => change({ photoInterval: Number(e.target.value) })}
        />
      </label>
      <Photos screenId={screen.id} photos={screen.photos} onChanged={onChanged} />
    </section>
  );
}
