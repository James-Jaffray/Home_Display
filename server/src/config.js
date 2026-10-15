import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

/** Thrown for any problem with the config; the message is safe to print (no values). */
export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb colour');
export const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes');

// Screen ids become URL parts (/display/<id>), so they must not collide with real routes.
const RESERVED_SCREEN_IDS = ['admin', 'display', 'api', 'photos', 'icons', 'assets'];
export const screenId = id.refine((value) => !RESERVED_SCREEN_IDS.includes(value), 'that name is reserved');

export const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'not a valid IANA timezone');

export const googleCalendar = z.strictObject({
  // Only Google is supported; the field is optional and kept so older files still load.
  provider: z.literal('google').default('google'),
  account: id,
  calendarId: z.string().min(1).default('primary'),
  label: z.string().min(1),
  color,
});

// Degrees clockwise. Lets a landscape TV that cannot rotate its own output show a portrait screen.
export const ROTATIONS = [0, 90, 180, 270];
export const rotation = z.union(ROTATIONS.map((r) => z.literal(r)));

// Quick-link buttons on a display: up to six round icon buttons beside or above/below the
// calendar. Each display has its own list.
export const MAX_LINKS = 6;
export const LINK_POSITIONS = ['top', 'bottom', 'left', 'right'];
// The built-in icons. The web app draws these by name (web/src/lib/icons.jsx); keep in step.
export const LINK_ICON_PRESETS = [
  'home', 'mail', 'calendar', 'globe', 'search', 'video', 'music', 'news', 'cart', 'bank',
  'map', 'cloud', 'code', 'chat', 'camera', 'notes', 'book', 'heart', 'star', 'game', 'settings', 'link',
];

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'must be a web address starting with http:// or https://');

// "preset:mail" (a built-in icon) or "image:<file>" (an uploaded picture for this display).
const linkIcon = z
  .string()
  .regex(/^(preset:[a-z]+|image:[A-Za-z0-9._-]+)$/, "use a built-in icon or an uploaded image")
  .refine(
    (value) => !value.startsWith('preset:') || LINK_ICON_PRESETS.includes(value.slice('preset:'.length)),
    'unknown built-in icon',
  );

const linkSchema = z.strictObject({
  title: z.string().trim().min(1).max(40),
  url: httpUrl,
  icon: linkIcon,
});

/** A display's list of links: at most six, and no address twice. */
export const linksSchema = z
  .array(linkSchema)
  .max(MAX_LINKS, `at most ${MAX_LINKS} links`)
  .superRefine((links, ctx) => {
    const seen = new Set();
    links.forEach((link, index) => {
      let key;
      try {
        key = new URL(link.url).href.replace(/\/$/, '');
      } catch {
        return; // not a web address: the address check on the field already reports it
      }
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [index, 'url'], message: 'this address is already in the list' });
      seen.add(key);
    });
  });

// How a display is used. "kiosk" is a wall screen: view only, no links or search bar.
// "interactive" is for a person at a browser: link buttons, the search bar, and clicking
// a date to see its full day.
export const MODES = ['kiosk', 'interactive'];

// A Google search bar on the display, for using it as a browser homepage. Off for wall
// screens. Older files stored "off" / "google" / "duckduckgo"; those still load (anything
// but "off" now means on).
export const searchFlag = z.preprocess(
  (value) => (value === 'off' ? false : value === 'google' || value === 'duckduckgo' ? true : value),
  z.boolean(),
);
export const SEARCH_POSITIONS = ['above', 'below'];

export const LAYOUTS = ['month-grid', 'portrait-agenda', 'portrait-week', 'landscape-split'];

export const screenSchema = z.strictObject({
  title: z.string().min(1),
  layout: z
    .enum(LAYOUTS)
    .default('month-grid'),
  // month-grid: how many weeks to show, starting with the current week.
  weeks: z.number().int().min(1).max(6).default(4),
  weekStart: z.enum(['sunday', 'monday']).default('sunday'),
  // Multiplies all text on the display (1 = normal).
  fontScale: z.number().min(0.7).max(1.6).default(1),
  rotate: rotation.default(0),
  mode: z.enum(MODES).default('kiosk'),
  search: searchFlag.default(false),
  searchPosition: z.enum(SEARCH_POSITIONS).default('below'),
  links: linksSchema.default([]),
  linksPosition: z.enum(LINK_POSITIONS).default('bottom'),
  timezone,
  clock: z.enum(['12', '24']).default('12'),
  calendars: z.array(id).default([]),
  photos: z
    .strictObject({
      folder: id.optional(),
      interval: z.number().int().min(5).max(3600).default(60),
    })
    .default({ interval: 60 }),
  token: z.string().min(16, 'use at least 16 characters').optional(),
});

const schema = z
  .strictObject({
    defaultScreen: id,
    calendars: z.record(id, googleCalendar).default({}),
    screens: z.record(id, screenSchema),
  })
  .superRefine((cfg, ctx) => {
    const add = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (!(cfg.defaultScreen in cfg.screens)) {
      add(['defaultScreen'], `"${cfg.defaultScreen}" is not defined under screens`);
    }
    for (const [sid, s] of Object.entries(cfg.screens)) {
      if (RESERVED_SCREEN_IDS.includes(sid)) {
        add(['screens', sid], `"${sid}" is reserved (the app uses it in its own URLs); pick another name`);
      }
      for (const cid of s.calendars) {
        if (!(cid in cfg.calendars)) add(['screens', sid, 'calendars'], `unknown calendar "${cid}"`);
      }
    }
  });

/**
 * Replace "${NAME}" in every string with process.env.NAME. Missing variables are
 * collected (names only) so the error never echoes a secret.
 * @param {unknown} node
 * @param {Record<string, string | undefined>} env
 * @param {Set<string>} missing
 */
function interpolate(node, env, missing) {
  if (typeof node === 'string') {
    return node.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
      if (env[name] === undefined || env[name] === '') {
        missing.add(name);
        return '';
      }
      return env[name];
    });
  }
  if (Array.isArray(node)) return node.map((n) => interpolate(n, env, missing));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, interpolate(v, env, missing)]));
  }
  return node;
}

/**
 * Validate an already-parsed config object.
 * @param {unknown} raw
 * @param {Record<string, string | undefined>} [env]
 */
export function validateConfig(raw, env = process.env) {
  const missing = new Set();
  const withEnv = interpolate(raw, env, missing);
  if (missing.size > 0) {
    throw new ConfigError([`environment variable(s) not set: ${[...missing].join(', ')}`]);
  }
  const result = schema.safeParse(withEnv);
  if (!result.success) {
    // path + message only: zod messages for some types would otherwise risk echoing input.
    throw new ConfigError(
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return result.data;
}

/**
 * Read and validate a YAML config file.
 * @param {string} path
 * @param {Record<string, string | undefined>} [env]
 */
export function loadConfig(path, env = process.env) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ConfigError([
      `cannot read ${path} (${err.code ?? 'error'}). Copy config/config.example.yaml to config/config.yaml`,
    ]);
  }
  let raw;
  try {
    raw = parse(text);
  } catch (err) {
    throw new ConfigError([`${path} is not valid YAML: ${err.message.split('\n')[0]}`]);
  }
  return validateConfig(raw, env);
}

/** @typedef {ReturnType<typeof validateConfig>} Config */
