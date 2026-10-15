import { accessSync, constants } from 'node:fs';

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
 * GET /api/health: used by Docker's HEALTHCHECK and the browser watchdog (later).
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, photosDir: string, version: string}} options
 */
export default async function healthRoutes(app, { services, photosDir, version }) {
  app.get('/api/health', async () => ({
    status: 'ok',
    version,
    uptime: Math.round(process.uptime()),
    screens: Object.keys(services.live.get().screens).length,
    photosReadable: isReadable(photosDir),
  }));
}
