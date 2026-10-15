import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, ConfigError } from '../src/config.js';

const good = () => ({
  defaultScreen: 'kitchen',
  calendars: {
    me: { provider: 'ical', url: '${FEED}', label: 'Me', color: '#112233' },
  },
  screens: { kitchen: { title: 'Kitchen', timezone: 'America/Edmonton', calendars: ['me'] } },
});

test('valid config passes and applies defaults', () => {
  const cfg = validateConfig(good(), { FEED: 'https://example.com/a.ics' });
  assert.equal(cfg.screens.kitchen.layout, 'month-grid');
  assert.equal(cfg.screens.kitchen.weeks, 4);
  assert.equal(cfg.screens.kitchen.photos.interval, 60);
  assert.equal(cfg.calendars.me.url, 'https://example.com/a.ics');
});

test('unknown keys are rejected', () => {
  const raw = good();
  raw.screens.kitchen.colour = 'red';
  assert.throws(() => validateConfig(raw, { FEED: 'https://example.com/a.ics' }), ConfigError);
});

test('unknown calendar and default screen are reported', () => {
  const raw = good();
  raw.defaultScreen = 'nope';
  raw.screens.kitchen.calendars = ['ghost'];
  assert.throws(
    () => validateConfig(raw, { FEED: 'https://example.com/a.ics' }),
    (err) => err.problems.length === 2,
  );
});

test('missing env var names the variable, not a value', () => {
  assert.throws(
    () => validateConfig(good(), {}),
    (err) => err instanceof ConfigError && err.message.includes('FEED'),
  );
});

test('bad timezone is rejected', () => {
  const raw = good();
  raw.screens.kitchen.timezone = 'Mars/Olympus';
  assert.throws(() => validateConfig(raw, { FEED: 'https://example.com/a.ics' }), ConfigError);
});
