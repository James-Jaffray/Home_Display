import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
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

/** Image types we accept for upload, recognised by their first bytes, not by what the client says. */
function sniffImageExtension(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return '.png';
  }
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return '.webp';
  }
  return null;
}

/**
 * Save an uploaded image into a screen's folder under a name WE choose (never the
 * client's file name). Returns the new file name, or null if it is not a supported image.
 *
 * @param {string} photosDir
 * @param {string} folder
 * @param {Buffer} data
 * @returns {Promise<string|null>}
 */
export async function savePhoto(photosDir, folder, data) {
  const ext = sniffImageExtension(data);
  if (!ext) return null;
  const name = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}${ext}`;
  const dir = join(photosDir, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), data);
  return name;
}

/**
 * Delete one photo. Returns false if the name is unsafe or the file does not exist.
 * @param {string} photosDir
 * @param {string} folder
 * @param {string} name
 */
export async function deletePhoto(photosDir, folder, name) {
  if (!isSafePhotoName(name)) return false;
  try {
    await unlink(join(photosDir, folder, name));
    return true;
  } catch {
    return false;
  }
}
