import Fastify, { LogController } from 'fastify';
import healthRoutes from './routes/health.js';
import screenRoutes from './routes/screens.js';
import eventRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import photoRoutes from './routes/photos.js';
import webRoutes from './routes/web.js';

/**
 * Build the Fastify app: create the server, then plug in one file of routes per topic.
 * Kept separate from index.js so tests can build an app and call `app.inject(...)`
 * without opening a network port.
 *
 * @param {object} options
 * @param {ReturnType<import('./settings.js').loadSettings>} options.settings  environment settings
 * @param {ReturnType<import('./services/index.js').createServices>} options.services
 * @param {boolean | object} [options.logger]  Fastify/pino logger options
 */
export async function buildApp({ settings, services, logger = false }) {
  // Request logging is off: URLs can carry per-screen tokens.
  const app = Fastify({ logger, logController: new LogController({ disableRequestLogging: true }) });

  const { photosDir } = settings;
  await app.register(healthRoutes, { services, photosDir, version: settings.version });
  await app.register(screenRoutes, { services, photosDir });
  await app.register(eventRoutes, { services });
  await app.register(authRoutes, { services });
  await app.register(adminRoutes, { services, photosDir });
  await app.register(photoRoutes, { services, photosDir });
  // Registered last: it owns "/" and the catch-all for unknown pages.
  await app.register(webRoutes, { services, webDist: settings.webDist });

  return app;
}
