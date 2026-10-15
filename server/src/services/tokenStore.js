import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Stores one Google refresh token per account name in <dataDir>/tokens.json.
 * The file holds bearer secrets: it is written owner-only and never logged or sent
 * to the browser. Writes are atomic (temp file + rename) so a power cut cannot leave
 * a half-written file, which matters on a Pi.
 *
 * @param {string} dataDir
 */
export function createTokenStore(dataDir) {
  const file = join(dataDir, 'tokens.json');
  // Serialise writes so two connects at once cannot overwrite each other.
  let queue = Promise.resolve();

  async function readAll() {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  }

  async function writeAll(tokens) {
    await mkdir(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    await rename(tmp, file);
  }

  return {
    /** @param {string} account @returns {Promise<string|null>} */
    async get(account) {
      return (await readAll())[account]?.refreshToken ?? null;
    },
    /** @param {string} account @param {string} refreshToken */
    set(account, refreshToken) {
      queue = queue.then(async () => {
        const tokens = await readAll();
        tokens[account] = { refreshToken, savedAt: new Date().toISOString() };
        await writeAll(tokens);
      });
      return queue;
    },
    /** @param {string} account */
    delete(account) {
      queue = queue.then(async () => {
        const tokens = await readAll();
        delete tokens[account];
        await writeAll(tokens);
      });
      return queue;
    },
  };
}
