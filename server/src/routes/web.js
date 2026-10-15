import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';

/**
 * The browser-facing pages: redirects to the default display, old-style links, and the
 * built React app (the wall display at /display/<id> and the dashboard at /admin).
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, webDist?: string}} options
 */
export default async function webRoutes(app, { services, webDist }) {
  const defaultDisplayUrl = () => `/display/${services.live.get().defaultScreen}`;

  // The wall screens live at /display/<id>. Bare / and /display go to the default one.
  app.get('/', async (_req, reply) => reply.redirect(defaultDisplayUrl()));
  app.get('/display', async (_req, reply) => reply.redirect(defaultDisplayUrl()));

  const hasWebApp = Boolean(webDist) && existsSync(join(webDist, 'index.html'));
  if (hasWebApp) {
    // index: false so "/" is handled by the redirect above, not the static plugin.
    await app.register(fastifyStatic, { root: webDist, index: false });
  }

  // Anything no route matched. React handles its own pages (/display/kitchen, /admin), so
  // unknown non-API GETs get the app shell; unknown /api paths stay JSON 404s so API
  // mistakes are easy to spot.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET') {
      // Old links like /kitchen keep working: send them to /display/kitchen.
      const [path] = req.url.split('?');
      const legacyId = path.replace(/^\/|\/$/g, '');
      if (legacyId && services.live.get().screens[legacyId]) return reply.redirect(`/display/${legacyId}`);
      if (hasWebApp && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
}
