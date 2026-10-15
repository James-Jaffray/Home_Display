const MAX_EDGE = 1920;

/**
 * Shrink a photo in the browser before uploading: phone photos are 4000+ px, which a
 * Raspberry Pi's Chromium struggles to decode. Doing it here means the server needs no
 * image library. EXIF rotation is applied so portrait photos stay upright.
 *
 * @param {File} file
 * @returns {Promise<Blob>} a JPEG, at most 1920 px on the long edge
 */
export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not process that image');
  return blob;
}

/**
 * Turn a picture into a small square icon: centred crop, 128 px, PNG. Done in the browser so
 * the server only ever receives a tiny file.
 *
 * @param {File} file
 * @param {number} [size]
 * @returns {Promise<Blob>}
 */
export async function squareIcon(file, size = 128) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not process that image');
  return blob;
}
