import { deletePhoto, listPhotos } from './photos.js';

/**
 * Custom icons for a display's links are small image files stored like photos, in
 * <iconsDir>/<display id>/. The photo helpers do the safe file handling (names we choose,
 * images only, no path tricks), so icons reuse them.
 */

/** How long an uploaded icon may sit unused before clean-up may delete it. */
const GRACE_MS = 10 * 60_000;

/**
 * Delete icon files in a display's folder that no link refers to any more.
 * Files younger than ten minutes are kept: they may be uploaded but not yet saved.
 *
 * @param {string} iconsDir
 * @param {string} displayId
 * @param {Array<{icon: string}>} links  the display's links as just saved
 * @param {number} [nowMs]
 */
export async function pruneLinkIcons(iconsDir, displayId, links, nowMs = Date.now()) {
  const used = new Set(links.filter((l) => l.icon.startsWith('image:')).map((l) => l.icon.slice('image:'.length)));

  for (const name of await listPhotos(iconsDir, displayId)) {
    if (used.has(name)) continue;
    // Names start with the upload time in base 36 (see savePhoto).
    const uploadedAt = parseInt(name.split('-')[0], 36);
    if (Number.isFinite(uploadedAt) && nowMs - uploadedAt < GRACE_MS) continue;
    await deletePhoto(iconsDir, displayId, name);
  }
}

/**
 * The picture for a link, as the display page wants it.
 * @param {string} displayId
 * @param {string} icon  "preset:mail" or "image:abc123.png"
 * @returns {{preset: string} | {imageUrl: string}}
 */
export function describeIcon(displayId, icon) {
  if (icon.startsWith('image:')) {
    return { imageUrl: `/icons/${displayId}/${encodeURIComponent(icon.slice('image:'.length))}` };
  }
  return { preset: icon.slice('preset:'.length) };
}
