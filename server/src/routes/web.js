import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';

/**
 * Serves the built React app and redirects "/" to the default screen.
 * @param {import('fastify').FastifyInstance} app
 * @param {{config: import('../config.js').Config, webDist?: string}} options
 */
export default async function webRoutes(app, { config, webDist }) {
  app.get('/', async (_req, reply) => reply.redirect(`/${config.defaultScreen}`));

  if (!webDist || !existsSync(join(webDist, 'index.html'))) return;

  // index: false so "/" is handled by the redirect above, not the static plugin.
  await app.register(fastifyStatic, { root: webDist, index: false });

  // React handles its own pages (/kitchen, /parents). Unknown non-API GETs get the app
  // shell; unknown /api paths stay JSON 404s so API mistakes are easy to spot.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'not found' });
  });
}
