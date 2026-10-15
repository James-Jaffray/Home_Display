import { deletePhoto, photoFolder, savePhoto } from '../../services/photos.js';
import { MAX_ICON_BYTES, MAX_UPLOAD_BYTES } from './context.js';

const NOT_AN_IMAGE = 'send the image as the request body (jpeg, png or webp)';

/**
 * Pictures a display owns: its background photos, and the icons of its link buttons.
 * Files are named by the server and checked by their contents (see services/photos.js).
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerImageRoutes(app, { services, photosDir, iconsDir, secured }) {
  const { live } = services;

  app.post('/api/admin/screens/:id/photos', { ...secured, bodyLimit: MAX_UPLOAD_BYTES }, async (req, reply) => {
    const screen = live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ error: NOT_AN_IMAGE });

    const name = await savePhoto(photosDir, photoFolder(req.params.id, screen), req.body);
    if (!name) return reply.code(415).send({ error: 'not a supported image' });
    return { ok: true, name, url: `/photos/${req.params.id}/${encodeURIComponent(name)}` };
  });

  app.delete('/api/admin/screens/:id/photos/:name', secured, async (req, reply) => {
    const screen = live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });

    const ok = await deletePhoto(photosDir, photoFolder(req.params.id, screen), req.params.name);
    return ok ? { ok: true } : reply.code(404).send({ error: 'not found' });
  });

  // A custom icon for one of the display's link buttons (the browser sends a 128px picture).
  app.post('/api/admin/screens/:id/link-icon', { ...secured, bodyLimit: MAX_ICON_BYTES }, async (req, reply) => {
    if (!live.get().screens[req.params.id]) return reply.code(404).send({ error: 'unknown screen' });
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ error: NOT_AN_IMAGE });

    // Icons live in a folder named after the display id.
    const name = await savePhoto(iconsDir, req.params.id, req.body);
    if (!name) return reply.code(415).send({ error: 'not a supported image' });
    return { ok: true, icon: `image:${name}`, url: `/icons/${req.params.id}/${encodeURIComponent(name)}` };
  });
}
