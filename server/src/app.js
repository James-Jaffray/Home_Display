import Fastify, { LogController } from 'fastify';
import healthRoutes from './routes/health.js';
import screenRoutes from './routes/screens.js';
import photoRoutes from './routes/photos.js';
import webRoutes from './routes/web.js';

/**
 * Build the Fastify app: create the server, then plug in one file of routes per topic.
 * Kept separate from index.js so tests can build an app and call `app.inject(...)`
 * without opening a network port.
 *
 * @param {object} options
 * @param {import('./config.js').Config} options.config  validated config
 * @param {string} options.photosDir  folder that holds one sub-folder of photos per screen
 * @param {string} [options.webDist]  built frontend folder; omitted in tests / API-only runs
 * @param {string} [options.version]
 * @param {boolean | object} [options.logger]  Fastify/pino logger options
 */
export async function buildApp({ config, photosDir, webDist, version = '0.0.0', logger = false }) {
  // Request logging is off: URLs can carry per-screen tokens.
  const app = Fastify({ logger, logController: new LogController({ disableRequestLogging: true }) });

  await app.register(healthRoutes, { config, photosDir, version });
  await app.register(screenRoutes, { config, photosDir });
  await app.register(photoRoutes, { config, photosDir });
  // Registered last: it owns "/" and the catch-all for unknown pages.
  await app.register(webRoutes, { config, webDist });

  return app;
}
