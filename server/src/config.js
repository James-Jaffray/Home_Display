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

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'not a valid IANA timezone');

export const googleCalendar = z.strictObject({
  provider: z.literal('google'),
  account: id,
  calendarId: z.string().min(1).default('primary'),
  label: z.string().min(1),
  color,
});

const icalCalendar = z.strictObject({
  provider: z.literal('ical'),
  url: z.url(),
  label: z.string().min(1),
  color,
});

export const LAYOUTS = ['month-grid', 'portrait-agenda', 'portrait-week', 'landscape-split'];

const screen = z.strictObject({
  title: z.string().min(1),
  layout: z
    .enum(LAYOUTS)
    .default('month-grid'),
  // month-grid: how many weeks to show, starting with the current week.
  weeks: z.number().int().min(1).max(6).default(4),
  weekStart: z.enum(['sunday', 'monday']).default('sunday'),
  // Multiplies all text on the display (1 = normal).
  fontScale: z.number().min(0.7).max(1.6).default(1),
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
    calendars: z.record(id, z.discriminatedUnion('provider', [googleCalendar, icalCalendar])).default({}),
    screens: z.record(id, screen),
  })
  .superRefine((cfg, ctx) => {
    const add = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (!(cfg.defaultScreen in cfg.screens)) {
      add(['defaultScreen'], `"${cfg.defaultScreen}" is not defined under screens`);
    }
    for (const [sid, s] of Object.entries(cfg.screens)) {
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
