import { openPhoto, photoFolder } from '../services/photos.js';

/**
 * GET /photos/:screen/:file streams one image. All the safety checks (name rules,
 * folder lookup) live in services/photos.js so they are easy to test.
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, photosDir: string}} options
 */
export default async function photoRoutes(app, { services, photosDir }) {
  app.get('/photos/:screen/:file', async (req, reply) => {
    const screen = services.live.get().screens[req.params.screen];
    if (!screen) return reply.code(404).send({ error: 'not found' });

    const photo = await openPhoto(photosDir, photoFolder(req.params.screen, screen), req.params.file);
    if (!photo) return reply.code(404).send({ error: 'not found' });

    return reply
      .header('Content-Type', photo.type)
      .header('Content-Length', photo.size)
      // Short cache so a deleted or replaced photo disappears quickly.
      .header('Cache-Control', 'public, max-age=300')
      .send(photo.stream);
  });
}
