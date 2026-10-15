import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { isSafePhotoName } from '../src/services/photos.js';

let root;
let app;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'kd-'));
  const photos = join(root, 'photos');
  mkdirSync(join(photos, 'kitchen'), { recursive: true });
  mkdirSync(join(photos, 'empty'), { recursive: true });
  writeFileSync(join(photos, 'kitchen', 'b.jpg'), 'jpeg-bytes');
  writeFileSync(join(photos, 'kitchen', 'a.png'), 'png-bytes');
  writeFileSync(join(photos, 'kitchen', 'notes.txt'), 'not an image');
  writeFileSync(join(photos, 'kitchen', '.hidden.jpg'), 'hidden');
  writeFileSync(join(root, 'config.yaml'), 'secret: true');
  const config = validateConfig({
    defaultScreen: 'kitchen',
    screens: {
      kitchen: { title: 'Kitchen', timezone: 'America/Edmonton' },
      empty: { title: 'Empty', timezone: 'UTC' },
      ghost: { title: 'No folder', timezone: 'UTC' },
    },
  });
  const settings = {
    version: '0.0.0',
    photosDir: photos,
    dataDir: join(root, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: '',
  };
  app = await buildApp({ settings, services: createServices({ config, settings }) });
});

after(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

test('lists only visible image files, sorted', async () => {
  const res = await app.inject('/api/screens/kitchen/photos');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().photos, ['/photos/kitchen/a.png', '/photos/kitchen/b.jpg']);
});

test('empty and missing folders list as empty, not an error', async () => {
  for (const id of ['empty', 'ghost']) {
    const res = await app.inject(`/api/screens/${id}/photos`);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().photos, []);
  }
});

test('serves a photo with the right type', async () => {
  const res = await app.inject('/photos/kitchen/b.jpg');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/jpeg');
  assert.equal(res.body, 'jpeg-bytes');
});

test('path traversal and non-image names are refused', async () => {
  const attempts = [
    '/photos/kitchen/..%2f..%2fconfig.yaml',
    '/photos/kitchen/..%5c..%5cconfig.yaml',
    '/photos/kitchen/%2e%2e%2fconfig.yaml',
    '/photos/kitchen/notes.txt',
    '/photos/kitchen/.hidden.jpg',
    '/photos/..%2fkitchen/b.jpg',
    '/photos/unknown/b.jpg',
  ];
  for (const url of attempts) {
    const res = await app.inject(url);
    assert.equal(res.statusCode, 404, url);
  }
});

test('unknown screen is a 404', async () => {
  assert.equal((await app.inject('/api/screens/nope')).statusCode, 404);
  assert.equal((await app.inject('/api/screens/nope/photos')).statusCode, 404);
});

test('screen endpoint exposes only display fields', async () => {
  const body = (await app.inject('/api/screens/kitchen')).json();
  assert.deepEqual(Object.keys(body).sort(), ['clock', 'fontScale', 'id', 'layout', 'photoInterval', 'timezone', 'title', 'weekStart', 'weeks']);
});

test('root redirects to the default screen', async () => {
  const res = await app.inject('/');
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/kitchen');
});

test('isSafePhotoName', () => {
  assert.ok(isSafePhotoName('a.JPG'));
  for (const bad of ['', '../a.jpg', 'a/b.jpg', 'a\\b.jpg', '.a.jpg', 'a.txt', 'a.jpg\0']) {
    assert.equal(isSafePhotoName(bad), false, JSON.stringify(bad));
  }
});
