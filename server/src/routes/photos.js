import { openPhoto, photoFolder } from '../services/photos.js';

/**
 * GET /photos/:screen/:file streams one image. All the safety checks (name rules,
 * folder lookup) live in services/photos.js so they are easy to test.
 * @param {import('fastify').FastifyInstance} app
 * @param {{config: import('../config.js').Config, photosDir: string}} options
 */
export default async function photoRoutes(app, { config, photosDir }) {
  app.get('/photos/:screen/:file', async (req, reply) => {
    const screen = config.screens[req.params.screen];
    if (!screen) return reply.code(404).send({ error: 'not found' });

    const photo = await openPhoto(photosDir, photoFolder(req.params.screen, screen), req.params.file);
    if (!photo) return reply.code(404).send({ error: 'not found' });

    return reply
      .header('Content-Type', photo.type)
      .header('Content-Length', photo.size)
      .header('Cache-Control', 'public, max-age=3600')
      .send(photo.stream);
  });
}
