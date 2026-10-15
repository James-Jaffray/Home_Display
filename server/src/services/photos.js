import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

// Served as-is. Phones produce 4000+ px originals that a Pi's Chromium struggles to
// decode, so docs recommend <= 1920 px on the long edge; resize-on-upload arrives with
// the admin UI (slice 4). A resize step here would add `sharp` for no gain yet.
const TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/**
 * A file name is acceptable only if it is a plain visible name with an image extension.
 * This is the traversal guard: no separators, no dots-only names, no hidden files.
 * @param {string} name
 */
export function isSafePhotoName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length < 256 &&
    !/[/\\\0]/.test(name) &&
    !name.startsWith('.') &&
    extname(name).toLowerCase() in TYPES
  );
}

/**
 * Folder for a screen: explicit `photos.folder`, else the screen id.
 * @param {string} screenId
 * @param {{photos: {folder?: string}}} screen
 */
export function photoFolder(screenId, screen) {
  return screen.photos.folder ?? screenId;
}

/**
 * List image files in a screen's folder. A missing or unreadable folder is just empty.
 * @param {string} photosDir
 * @param {string} folder
 * @returns {Promise<string[]>}
 */
export async function listPhotos(photosDir, folder) {
  try {
    const entries = await readdir(join(photosDir, folder), { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && isSafePhotoName(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Open a photo for streaming, or null if the name is unsafe or the file is missing.
 * @param {string} photosDir
 * @param {string} folder
 * @param {string} name
 */
export async function openPhoto(photosDir, folder, name) {
  if (!isSafePhotoName(name)) return null;
  const path = join(photosDir, folder, name);
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return {
      stream: createReadStream(path),
      type: TYPES[extname(name).toLowerCase()],
      size: info.size,
      mtimeMs: info.mtimeMs,
    };
  } catch {
    return null;
  }
}
