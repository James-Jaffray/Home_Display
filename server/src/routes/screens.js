import { listPhotos, photoFolder } from '../services/photos.js';
import { describeIcon } from '../services/linkIcons.js';
import { displayGuard } from './displayGuard.js';

/**
 * Screen info for the browser. Only display fields are sent: never calendars, tokens
 * or filesystem paths.
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, photosDir: string}} options
 */
export default async function screenRoutes(app, { services, photosDir }) {
  // GET /api/default-screen: which display a bare /display should show.
  app.get('/api/default-screen', async () => ({ id: services.live.get().defaultScreen }));

  // GET /api/screens/kitchen
  app.get('/api/screens/:id', { preHandler: displayGuard(services) }, async (req, reply) => {
    const screen = services.live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    const interactive = screen.mode === 'interactive';
    return {
      id: req.params.id,
      title: screen.title,
      layout: screen.layout,
      weeks: screen.weeks,
      weekStart: screen.weekStart,
      timezone: screen.timezone,
      clock: screen.clock,
      fontScale: screen.fontScale,
      rotate: screen.rotate,
      mode: screen.mode,
      search: interactive && screen.search,
      searchPosition: screen.searchPosition,
      linksPosition: screen.linksPosition,
      links: (interactive ? screen.links : []).map((link) => ({
        title: link.title,
        url: link.url,
        icon: describeIcon(req.params.id, link.icon),
      })),
      photoInterval: screen.photos.interval,
    };
  });

  // GET /api/screens/kitchen/photos
  app.get('/api/screens/:id/photos', { preHandler: displayGuard(services) }, async (req, reply) => {
    const screen = services.live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    const names = await listPhotos(photosDir, photoFolder(req.params.id, screen));
    // URLs use the screen id, not the folder name, and are served by routes/photos.js.
    return { photos: names.map((n) => `/photos/${req.params.id}/${encodeURIComponent(n)}`) };
  });
}
