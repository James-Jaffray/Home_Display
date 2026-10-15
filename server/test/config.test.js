import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, ConfigError } from '../src/config.js';

const good = () => ({
  defaultScreen: 'kitchen',
  calendars: {
    me: { provider: 'google', account: 'james', calendarId: '${CAL_ID}', label: 'Me', color: '#112233' },
  },
  screens: { kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['me'] } },
});

test('valid config passes and applies defaults', () => {
  const cfg = validateConfig(good(), { CAL_ID: 'family@group.calendar.google.com' });
  assert.equal(cfg.screens.kitchen.layout, 'month-grid');
  assert.equal(cfg.screens.kitchen.weeks, 4);
  assert.equal(cfg.screens.kitchen.photos.interval, 60);
  assert.equal(cfg.calendars.me.calendarId, 'family@group.calendar.google.com');
});

test('unknown keys are rejected', () => {
  const raw = good();
  raw.screens.kitchen.colour = 'red';
  assert.throws(() => validateConfig(raw, { CAL_ID: 'family@group.calendar.google.com' }), ConfigError);
});

test('unknown calendar and default screen are reported', () => {
  const raw = good();
  raw.defaultScreen = 'nope';
  raw.screens.kitchen.calendars = ['ghost'];
  assert.throws(
    () => validateConfig(raw, { CAL_ID: 'family@group.calendar.google.com' }),
    (err) => err.problems.length === 2,
  );
});

test('missing env var names the variable, not a value', () => {
  assert.throws(
    () => validateConfig(good(), {}),
    (err) => err instanceof ConfigError && err.message.includes('CAL_ID'),
  );
});

test('bad timezone is rejected', () => {
  const raw = good();
  raw.screens.kitchen.timezone = 'Mars/Olympus';
  assert.throws(() => validateConfig(raw, { CAL_ID: 'family@group.calendar.google.com' }), ConfigError);
});
