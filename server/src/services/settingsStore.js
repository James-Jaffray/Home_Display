import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { LAYOUTS, googleCalendar, id } from '../config.js';

/**
 * Dashboard-editable overrides for one screen. Every field is optional: anything not set
 * here falls back to config.yaml.
 */
export const screenOverrideSchema = z.strictObject({
  title: z.string().min(1).max(60).optional(),
  layout: z.enum(LAYOUTS).optional(),
  weeks: z.number().int().min(1).max(6).optional(),
  weekStart: z.enum(['sunday', 'monday']).optional(),
  clock: z.enum(['12', '24']).optional(),
  fontScale: z.number().min(0.7).max(1.6).optional(),
  photoInterval: z.number().int().min(5).max(3600).optional(),
  calendars: z.array(id).max(20).optional(),
});

const settingsSchema = z.strictObject({
  screens: z.record(id, screenOverrideSchema).default({}),
  // Calendars added from the dashboard (config.yaml calendars are never stored here).
  calendars: z.record(id, googleCalendar).default({}),
});

/** @typedef {z.infer<typeof settingsSchema>} Settings */

/**
 * Reads and writes <dataDir>/settings.json: the choices made in the dashboard.
 * config.yaml stays the read-only starting point; this file only holds overrides.
 * Writes are atomic (temp file + rename) and serialised.
 *
 * @param {string} dataDir
 */
export function createSettingsStore(dataDir) {
  const file = join(dataDir, 'settings.json');
  /** @type {Settings} */
  let current = settingsSchema.parse({});
  let queue = Promise.resolve();

  return {
    /** Load from disk once at startup. A missing file is fine; a corrupt one is reported. */
    async init() {
      try {
        current = settingsSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw new Error(`Cannot read ${file}: ${err.message.split('\n')[0]}`, { cause: err });
        }
      }
    },

    /** @returns {Settings} */
    get() {
      return current;
    },

    /**
     * Validate and persist a whole new settings object.
     * @param {unknown} next
     * @returns {Promise<Settings>}
     */
    replace(next) {
      const parsed = settingsSchema.parse(next);
      queue = queue.then(async () => {
        await mkdir(dataDir, { recursive: true });
        const tmp = `${file}.tmp`;
        await writeFile(tmp, JSON.stringify(parsed, null, 2));
        await rename(tmp, file);
        current = parsed;
      });
      return queue.then(() => parsed);
    },

    /** Check a candidate without saving it. @param {unknown} next */
    parse(next) {
      return settingsSchema.parse(next);
    },
  };
}
