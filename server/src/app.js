import Fastify, { LogController } from 'fastify';
import healthRoutes from './routes/health.js';
import screenRoutes from './routes/screens.js';
import eventRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin/index.js';
import photoRoutes from './routes/photos.js';
import iconRoutes from './routes/icons.js';
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

  // Safe browser defaults on every response. A display address can carry ?k=<token>, so the
  // browser must not pass it on as a Referer when a link button opens another site; and only
  // this site may frame its pages (the dashboard's live preview does exactly that).
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
  });

  const { photosDir, iconsDir } = settings;
  // The host browsers use to reach this app (from PUBLIC_BASE_URL); trusted by the
  // dashboard's same-site check.
  const publicHost = new URL(settings.publicBaseUrl).host;
  await app.register(healthRoutes, { services, photosDir, version: settings.version, webDist: settings.webDist });
  await app.register(screenRoutes, { services, photosDir });
  await app.register(eventRoutes, { services });
  await app.register(authRoutes, { services, publicHost });
  await app.register(adminRoutes, { services, photosDir, iconsDir, publicHost, publicBaseUrl: settings.publicBaseUrl });
  await app.register(photoRoutes, { services, photosDir });
  await app.register(iconRoutes, { services, iconsDir });
  // Registered last: it owns "/" and the catch-all for unknown pages.
  await app.register(webRoutes, { services, webDist: settings.webDist });

  return app;
}
