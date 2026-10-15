import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgenda, addDays, localDate, weekStartDate } from '../src/services/agenda.js';

const TZ = 'America/Edmonton';
// 2026-10-14 12:00 in Edmonton (MDT, UTC-6) = 18:00 UTC
const NOW = Date.parse('2026-10-14T18:00:00Z');

const event = (over) => ({
  id: 'e',
  calendarId: 'c',
  title: 'Event',
  location: null,
  allDay: false,
  start: '2026-10-14T15:00:00-06:00',
  end: '2026-10-14T16:00:00-06:00',
  ...over,
});

test('addDays is calendar arithmetic, not 24h arithmetic', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02'); // DST change in Edmonton
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('today is computed in the screen timezone, not UTC', () => {
  // 23:30 Edmonton on the 14th is already the 15th in UTC.
  const late = Date.parse('2026-10-15T05:30:00Z');
  assert.equal(localDate(late, TZ), '2026-10-14');
  assert.equal(buildAgenda({ events: [], timezone: TZ, days: 1, nowMs: late }).today, '2026-10-14');
});

test('returns one entry per day, empty days included', () => {
  const { days } = buildAgenda({ events: [], timezone: TZ, days: 3, nowMs: NOW });
  assert.deepEqual(days.map((d) => d.date), ['2026-10-14', '2026-10-15', '2026-10-16']);
});

test('all-day event ending "tomorrow" only shows today (end date is exclusive)', () => {
  const e = event({ allDay: true, start: '2026-10-14', end: '2026-10-15' });
  const { days } = buildAgenda({ events: [e], timezone: TZ, days: 3, nowMs: NOW });
  assert.deepEqual(days.map((d) => d.events.length), [1, 0, 0]);
});

test('multi-day all-day event shows on each day it covers', () => {
  const e = event({ allDay: true, start: '2026-10-14', end: '2026-10-17' });
  const { days } = buildAgenda({ events: [e], timezone: TZ, days: 4, nowMs: NOW });
  assert.deepEqual(days.map((d) => d.events.length), [1, 1, 1, 0]);
});

test('timed event ending exactly at midnight stays on its own day', () => {
  const e = event({ start: '2026-10-14T22:00:00-06:00', end: '2026-10-15T00:00:00-06:00' });
  const { days } = buildAgenda({ events: [e], timezone: TZ, days: 2, nowMs: NOW });
  assert.deepEqual(days.map((d) => d.events.length), [1, 0]);
});

test('event across midnight appears on both days', () => {
  const e = event({ start: '2026-10-14T22:00:00-06:00', end: '2026-10-15T01:00:00-06:00' });
  const { days } = buildAgenda({ events: [e], timezone: TZ, days: 2, nowMs: NOW });
  assert.deepEqual(days.map((d) => d.events.length), [1, 1]);
});

test('all-day first, then by start time; finished events are flagged', () => {
  const events = [
    event({ id: 'late', title: 'Late', start: '2026-10-14T18:00:00-06:00', end: '2026-10-14T19:00:00-06:00' }),
    event({ id: 'done', title: 'Done', start: '2026-10-14T08:00:00-06:00', end: '2026-10-14T09:00:00-06:00' }),
    event({ id: 'all', title: 'Birthday', allDay: true, start: '2026-10-14', end: '2026-10-15' }),
  ];
  const [today] = buildAgenda({ events, timezone: TZ, days: 1, nowMs: NOW }).days;
  assert.deepEqual(today.events.map((e) => e.id), ['all', 'done', 'late']);
  assert.equal(today.events[1].ended, true);
  assert.equal(today.events[2].ended, false);
});

test('DST: an event on the night clocks go back keeps its local date', () => {
  // New York falls back on 2026-11-01 at 02:00 (a zone whose rule is stable in tz data).
  const tz = 'America/New_York';
  const now = Date.parse('2026-11-01T12:00:00Z');
  const e = event({ start: '2026-11-01T23:00:00-05:00', end: '2026-11-01T23:30:00-05:00' });
  const { today, days } = buildAgenda({ events: [e], timezone: tz, days: 2, nowMs: now });
  assert.equal(today, '2026-11-01');
  assert.deepEqual(days.map((d) => d.events.length), [1, 0]);
});

test('weekStartDate: Sunday and Monday week starts', () => {
  // 2026-10-14 is a Wednesday.
  assert.equal(weekStartDate('2026-10-14', 'sunday'), '2026-10-11');
  assert.equal(weekStartDate('2026-10-14', 'monday'), '2026-10-12');
  assert.equal(weekStartDate('2026-10-11', 'sunday'), '2026-10-11'); // already the start
  assert.equal(weekStartDate('2026-10-11', 'monday'), '2026-10-05'); // Sunday belongs to the week before
});

test('startDate lets the grid begin before today', () => {
  const { today, days } = buildAgenda({ events: [], timezone: TZ, days: 14, nowMs: NOW, startDate: '2026-10-11' });
  assert.equal(today, '2026-10-14');
  assert.equal(days[0].date, '2026-10-11');
  assert.equal(days.length, 14);
});
