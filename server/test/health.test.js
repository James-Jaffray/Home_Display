import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { buildApp } from '../src/app.js';

const config = validateConfig({
  defaultScreen: 'kitchen',
  screens: { kitchen: { title: 'Kitchen', timezone: 'UTC' } },
});

async function appWith(webDist) {
  const dir = mkdtempSync(join(tmpdir(), 'kd-health-'));
  const settings = {
    version: '1.2.3',
    photosDir: join(dir, 'photos'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: '',
    webDist,
  };
  const app = await buildApp({ settings, services: createServices({ config, settings }) });
  return { app, dir };
}

test('health lists the web app files so open pages can tell they are out of date', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'kd-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(
    join(dist, 'index.html'),
    '<html><head><script type="module" src="/assets/index-AAA.js"></script>' +
      '<link rel="stylesheet" href="/assets/index-BBB.css"></head><body><div id="root"></div></body></html>',
  );

  const { app, dir } = await appWith(dist);
  const body = (await app.inject('/api/health')).json();
  assert.equal(body.status, 'ok');
  assert.equal(body.version, '1.2.3');
  assert.deepEqual(body.webAssets, ['/assets/index-AAA.js', '/assets/index-BBB.css']);

  await app.close();
  rmSync(dist, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('health with no built web app lists no assets (and does not fail)', async () => {
  const { app, dir } = await appWith(undefined);
  assert.deepEqual((await app.inject('/api/health')).json().webAssets, []);
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});
