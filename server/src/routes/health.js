import { accessSync, constants, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} dir */
function isReadable(dir) {
  try {
    accessSync(dir, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The hashed asset files the built web app is made of (e.g. "/assets/index-DexIO9WY.js").
 * Their names change whenever the web app does, so a page that finds the server listing
 * different files than the ones it loaded knows it is out of date. Empty when there is no
 * built web app (API-only runs).
 * @param {string|undefined} webDist
 * @returns {string[]}
 */
function webAssets(webDist) {
  if (!webDist) return [];
  try {
    const html = readFileSync(join(webDist, 'index.html'), 'utf8');
    const found = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    return [...new Set(found)].sort();
  } catch {
    return [];
  }
}
/**
 * GET /api/health: used by Docker's HEALTHCHECK and by open display pages.
 *
 * `webAssets` lists the web app files being served. An open display page compares it with
 * the files it loaded with and reloads itself when they differ, so a redeploy reaches every
 * screen without anyone touching it.
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, photosDir: string, version: string}} options
 */
export default async function healthRoutes(app, { services, photosDir, version, webDist }) {
  const assets = webAssets(webDist);

  app.get('/api/health', async () => ({
    status: 'ok',
    version,
    uptime: Math.round(process.uptime()),
    screens: Object.keys(services.live.get().screens).length,
    photosReadable: isReadable(photosDir),
    webAssets: assets,
  }));
}
