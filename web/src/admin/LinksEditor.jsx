import { useState } from 'react';
import { PRESET_ICON_NAMES, PresetIcon } from '../lib/icons.jsx';
import { api } from './api.js';
import { squareIcon } from './resizeImage.js';

const MAX_LINKS = 6; // keep in step with MAX_LINKS in server/src/config.js

const POSITIONS = [
  ['top', 'Row above the calendar'],
  ['bottom', 'Row below the calendar'],
  ['left', 'Column on the left'],
  ['right', 'Column on the right'],
];

/** What is wrong with one link, in words, or null if it is fine. */
function problemFor(link, links, index) {
  if (!link.title.trim()) return 'Give it a name.';
  let normalized;
  try {
    const url = new URL(link.url.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('not http');
    normalized = url.href.replace(/\/$/, '');
  } catch {
    return 'Enter a web address starting with http:// or https://';
  }
  const clash = links.some((other, i) => {
    if (i === index) return false;
    try {
      return new URL(other.url.trim()).href.replace(/\/$/, '') === normalized;
    } catch {
      return false;
    }
  });
  return clash ? 'This address is already in the list.' : null;
}

/** The picture for a link, as the dashboard shows it. */
function IconPreview({ icon, screenId, token, className = '' }) {
  if (icon.startsWith('image:')) {
    const name = encodeURIComponent(icon.slice('image:'.length));
    const key = token ? `?k=${encodeURIComponent(token)}` : '';
    return <img src={`/icons/${screenId}/${name}${key}`} alt="" className={`size-full object-cover ${className}`} />;
  }
  return <PresetIcon name={icon.slice('preset:'.length)} className={`size-[58%] ${className}`} />;
}

/**
 * Up to six round link buttons for one display: name, address, icon (built-in or an
 * uploaded picture), and where they sit around the calendar.
 *
 * @param {object} props
 * @param {string} props.screenId
 * @param {string|null} props.token  the display's access token, for showing uploaded icons
 * @param {Array<{title: string, url: string, icon: string}>} props.links
 * @param {'top'|'bottom'|'left'|'right'} props.position
 * @param {(links: Array, allValid: boolean) => void} props.onLinks  called on every edit
 * @param {(position: string) => void} props.onPosition
 */
export default function LinksEditor({ screenId, token, links, position, onLinks, onPosition }) {
  const [pickerOpen, setPickerOpen] = useState(null); // index of the link choosing an icon
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const problems = links.map((link, i) => problemFor(link, links, i));

  function update(next) {
    onLinks(
      next,
      next.every((link, i) => problemFor(link, next, i) === null),
    );
  }

  const edit = (index, patch) => update(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  const remove = (index) => {
    setPickerOpen(null);
    update(links.filter((_, i) => i !== index));
  };
  const move = (index, by) => {
    const target = index + by;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    setPickerOpen(null);
    update(next);
  };

  async function upload(index, file) {
    setUploading(true);
    setUploadError('');
    try {
      const blob = await squareIcon(file);
      const { icon } = await api(`/api/admin/screens/${screenId}/link-icon`, { method: 'POST', blob });
      edit(index, { icon });
      setPickerOpen(null);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-4" role="radiogroup" aria-label="Where the link buttons go">
        <span className="label">Where they go</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POSITIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={position === value}
              className={`choice ${position === value ? 'choice-on' : ''}`}
              onClick={() => onPosition(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {links.map((link, index) => (
          <li key={index} className="rounded-xl border border-white/10 bg-surface p-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Choose icon"
                title="Choose icon"
                onClick={() => setPickerOpen(pickerOpen === index ? null : index)}
                className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-surface-raised text-text hover:border-accent"
              >
                <IconPreview icon={link.icon} screenId={screenId} token={token} />
              </button>

              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Name (e.g. Gmail)"
                  aria-label="Link name"
                  maxLength={40}
                  value={link.title}
                  onChange={(e) => edit(index, { title: e.target.value })}
                />
                <input
                  className="field"
                  placeholder="https://…"
                  aria-label="Link address"
                  inputMode="url"
                  value={link.url}
                  onChange={(e) => edit(index, { url: e.target.value })}
                />
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn btn-small" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                  ↑
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => move(index, 1)}
                  disabled={index === links.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
              <button className="btn btn-small shrink-0" onClick={() => remove(index)} aria-label="Remove link">
                ✕
              </button>
            </div>

            {problems[index] && <p className="mt-2 text-sm text-warn">{problems[index]}</p>}

            {pickerOpen === index && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {PRESET_ICON_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={link.icon === `preset:${name}`}
                      onClick={() => {
                        edit(index, { icon: `preset:${name}` });
                        setPickerOpen(null);
                      }}
                      className={`flex aspect-square items-center justify-center rounded-full border text-text hover:border-accent ${
                        link.icon === `preset:${name}` ? 'border-accent bg-accent/20' : 'border-white/15'
                      }`}
                    >
                      <PresetIcon name={name} className="size-[55%]" />
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="btn cursor-pointer">
                    {uploading ? 'Uploading…' : 'Upload your own picture'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        e.target.value = '';
                        if (file) upload(index, file);
                      }}
                    />
                  </label>
                  <span className="text-sm text-text-muted">Squared and shrunk to 128 px in your browser.</span>
                </div>
                {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <button
          className="btn"
          disabled={links.length >= MAX_LINKS}
          onClick={() => {
            update([...links, { title: '', url: 'https://', icon: 'preset:link' }]);
            setPickerOpen(links.length);
          }}
        >
          Add a link
        </button>
        <span className="text-sm text-text-muted">
          {links.length} of {MAX_LINKS}. These links belong to this display only.
        </span>
      </div>
    </div>
  );
}
