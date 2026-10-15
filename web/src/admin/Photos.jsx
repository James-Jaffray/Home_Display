import { useRef, useState } from 'react';
import { api } from './api.js';
import { resizeImage } from './resizeImage.js';

/**
 * Thumbnails of a screen's background photos, with upload and delete.
 * @param {{screenId: string, photos: Array<{name: string, url: string}>, onChanged: () => void}} props
 */
export default function Photos({ screenId, photos, onChanged }) {
  const input = useRef(null);
  const [status, setStatus] = useState('');

  async function upload(files) {
    let done = 0;
    for (const file of files) {
      setStatus(`Uploading ${done + 1} of ${files.length}…`);
      try {
        const blob = await resizeImage(file);
        await api(`/api/admin/screens/${screenId}/photos`, { method: 'POST', blob });
        done += 1;
      } catch (err) {
        setStatus(`${file.name}: ${err.message}`);
        onChanged();
        return;
      }
    }
    setStatus(`Added ${done} photo${done === 1 ? '' : 's'}`);
    onChanged();
  }

  async function remove(name) {
    await api(`/api/admin/screens/${screenId}/photos/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {});
    onChanged();
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.name} className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-surface">
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            <button
              className="btn absolute right-1 bottom-1 px-2 py-1 text-sm"
              onClick={() => remove(p.name)}
              aria-label="Delete photo"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="text-text-muted">No photos yet: the screen shows a plain background.</p>}

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            upload([...e.target.files]);
            e.target.value = '';
          }}
        />
        <button className="btn btn-primary" onClick={() => input.current.click()}>
          Upload photos
        </button>
        <span className="text-sm text-text-muted">{status}</span>
      </div>
      <p className="mt-2 text-sm text-text-muted">Photos are shrunk to 1920 px in your browser before uploading.</p>
    </div>
  );
}
