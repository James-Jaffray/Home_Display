import { listPhotos, photoFolder } from '../services/photos.js';

/**
 * Screen info for the browser. Only display fields are sent: never calendars, tokens
 * or filesystem paths.
 * @param {import('fastify').FastifyInstance} app
 * @param {{config: import('../config.js').Config, photosDir: string}} options
 */
export default async function screenRoutes(app, { config, photosDir }) {
  // GET /api/screens/kitchen
  app.get('/api/screens/:id', async (req, reply) => {
    const screen = config.screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    return {
      id: req.params.id,
      title: screen.title,
      layout: screen.layout,
      timezone: screen.timezone,
      clock: screen.clock,
      photoInterval: screen.photos.interval,
    };
  });

  // GET /api/screens/kitchen/photos
  app.get('/api/screens/:id/photos', async (req, reply) => {
    const screen = config.screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    const names = await listPhotos(photosDir, photoFolder(req.params.id, screen));
    // URLs use the screen id, not the folder name, and are served by routes/photos.js.
    return { photos: names.map((n) => `/photos/${req.params.id}/${encodeURIComponent(n)}`) };
  });
}
