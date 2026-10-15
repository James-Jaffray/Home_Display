import { join } from 'node:path';
import { createSerialQueue, readJson, writeFileAtomic } from './atomicFile.js';

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
  const queue = createSerialQueue();

  const readAll = () => readJson(file, {});
  const writeAll = (tokens) => writeFileAtomic(file, JSON.stringify(tokens, null, 2), 0o600);

  /** Read, change, write: always through the queue. */
  function update(change) {
    return queue.run(async () => {
      const tokens = await readAll();
      change(tokens);
      await writeAll(tokens);
    });
  }

  return {
    /** @param {string} account @returns {Promise<string|null>} */
    async get(account) {
      return (await readAll())[account]?.refreshToken ?? null;
    },

    /** The Google address a name was connected with, if known. @param {string} account */
    async email(account) {
      return (await readAll())[account]?.email ?? null;
    },

    /** Which account name already uses this Google address? @param {string} email */
    async accountWithEmail(email) {
      const all = await readAll();
      return Object.keys(all).find((name) => all[name].email === email) ?? null;
    },

    /**
     * @param {string} account
     * @param {string} refreshToken
     * @param {{email?: string|null}} [extra]
     */
    set(account, refreshToken, extra = {}) {
      return update((tokens) => {
        tokens[account] = { refreshToken, email: extra.email ?? null, savedAt: new Date().toISOString() };
      });
    },

    /** @param {string} account */
    delete(account) {
      return update((tokens) => {
        delete tokens[account];
      });
    },
  };
}
