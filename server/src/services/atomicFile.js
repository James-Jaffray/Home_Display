import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Windows briefly locks a file that another handle is reading or replacing (EPERM/EBUSY).
// A short retry makes that a non-event instead of a lost write.
async function retryOnLock(action) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code) || attempt >= 5) throw err;
      await sleep(20 * (attempt + 1));
    }
  }
}

/**
 * Read a JSON file; a missing file gives `fallback`.
 * @template T
 * @param {string} file
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await retryOnLock(() => readFile(file, 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * Write a file so a power cut can never leave it half-written: write a temp file next to
 * it, then rename over the original.
 * @param {string} file
 * @param {string} text
 * @param {number} [mode]  file permissions (tokens use 0o600)
 */
export async function writeFileAtomic(file, text, mode) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, text, mode === undefined ? undefined : { mode });
  await retryOnLock(() => rename(tmp, file));
}

/**
 * Runs async tasks one at a time, in order. A failing task rejects for its own caller
 * only; it never blocks the tasks queued after it.
 */
export function createSerialQueue() {
  let tail = Promise.resolve();
  return {
    /**
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    run(task) {
      const result = tail.then(task, task);
      tail = result.catch(() => {});
      return result;
    },
  };
}
