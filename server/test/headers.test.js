import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../src/config.js';
import { createServices } from '../src/services/index.js';
import { buildApp } from '../src/app.js';

test('every response carries the safe browser headers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kd-headers-'));
  const config = validateConfig({ defaultScreen: 'kitchen', screens: { kitchen: { title: 'Kitchen', timezone: 'UTC' } } });
  const settings = {
    version: '0.0.0',
    photosDir: join(dir, 'photos'),
    iconsDir: join(dir, 'icons'),
    dataDir: join(dir, 'data'),
    publicBaseUrl: 'http://localhost:8080',
    google: { clientId: '', clientSecret: '' },
    adminPassword: '',
  };
  const app = await buildApp({ settings, services: createServices({ config, settings }) });

  for (const url of ['/api/health', '/api/screens/kitchen', '/api/screens/nope', '/display', '/api/admin/session']) {
    const res = await app.inject(url);
    assert.equal(res.headers['x-content-type-options'], 'nosniff', url);
    assert.equal(res.headers['referrer-policy'], 'no-referrer', url);
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN', url);
  }

  await app.close();
  rmSync(dir, { recursive: true, force: true });
});
