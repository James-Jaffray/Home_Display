import { join } from 'node:path';
import { z } from 'zod';
import {
  LAYOUTS,
  LINK_POSITIONS,
  MODES,
  SEARCH_POSITIONS,
  googleCalendar,
  id,
  linksSchema,
  rotation,
  screenId,
  screenSchema,
  searchFlag,
  timezone,
} from '../config.js';
import { createSerialQueue, readJson, writeFileAtomic } from './atomicFile.js';

/**
 * Dashboard-editable overrides for one screen. Every field is optional: anything not set
 * here falls back to config.yaml.
 */
export const screenOverrideSchema = z.strictObject({
  title: z.string().min(1).max(60).optional(),
  timezone: timezone.optional(),
  layout: z.enum(LAYOUTS).optional(),
  weeks: z.number().int().min(1).max(6).optional(),
  weekStart: z.enum(['sunday', 'monday']).optional(),
  clock: z.enum(['12', '24']).optional(),
  fontScale: z.number().min(0.7).max(1.6).optional(),
  rotate: rotation.optional(),
  mode: z.enum(MODES).optional(),
  search: searchFlag.optional(),
  searchPosition: z.enum(SEARCH_POSITIONS).optional(),
  links: linksSchema.optional(),
  linksPosition: z.enum(LINK_POSITIONS).optional(),
  photoInterval: z.number().int().min(5).max(3600).optional(),
  calendars: z.array(id).max(20).optional(),
  // Access token for the display's address. Set by the dashboard, never typed by hand.
  token: z.string().min(16).max(128).optional(),
});

const settingsSchema = z.strictObject({
  screens: z.record(id, screenOverrideSchema).default({}),
  // Displays created in the dashboard (config.yaml displays are never stored here).
  displays: z.record(screenId, screenSchema).default({}),
  // Google account names added from the dashboard (a name only; its token lives in tokens.json).
  accounts: z.array(id).default([]),
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
  const queue = createSerialQueue();

  return {
    /** Load from disk once at startup. A missing file is fine; a corrupt one is reported. */
    async init() {
      try {
        current = settingsSchema.parse(await readJson(file, {}));
      } catch (err) {
        throw new Error(`Cannot read ${file}: ${err.message.split('\n')[0]}`, { cause: err });
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
      return queue.run(async () => {
        // 0600: the file can hold display tokens.
        await writeFileAtomic(file, JSON.stringify(parsed, null, 2), 0o600);
        current = parsed;
        return parsed;
      });
    },

    /** Check a candidate without saving it. @param {unknown} next */
    parse(next) {
      return settingsSchema.parse(next);
    },
  };
}
