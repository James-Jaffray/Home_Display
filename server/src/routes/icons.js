import { openPhoto } from '../services/photos.js';
import { displayGuard } from './displayGuard.js';

/**
 * GET /icons/:screen/:file streams a custom link icon. Same rule as photos: only for a real
 * display, only safe image names, and only if the caller may see that display.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, iconsDir: string}} options
 */
export default async function iconRoutes(app, { services, iconsDir }) {
  app.get('/icons/:screen/:file', { preHandler: displayGuard(services, 'screen') }, async (req, reply) => {
    if (!services.live.get().screens[req.params.screen]) return reply.code(404).send({ error: 'not found' });

    // Icons live in a folder named after the display id.
    const icon = await openPhoto(iconsDir, req.params.screen, req.params.file);
    if (!icon) return reply.code(404).send({ error: 'not found' });

    return reply
      .header('Content-Type', icon.type)
      .header('Content-Length', icon.size)
      .header('Cache-Control', 'public, max-age=300')
      .send(icon.stream);
  });
}
