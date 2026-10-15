/**
 * A row of buttons where exactly one is chosen (a friendlier "select" for a few options).
 *
 * @param {object} props
 * @param {string} props.label  what the choice is, for screen readers
 * @param {Array<[string|number, string]>} props.options  [value, text] pairs
 * @param {string|number} props.value
 * @param {(value: string|number) => void} props.onChange
 */
export default function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([optionValue, text]) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className={`choice ${value === optionValue ? 'choice-on' : ''}`}
          onClick={() => onChange(optionValue)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
