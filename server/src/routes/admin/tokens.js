import { randomBytes } from 'node:crypto';

/**
 * A display's access token: make a new one, or stop requiring one.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerTokenRoutes(app, { services, secured, applySettings }) {
  const { live } = services;

  // Make (or replace) a display's token. Anyone with the old address stops working.
  app.post('/api/admin/screens/:id/token', secured, async (req, reply) => {
    const displayId = req.params.id;
    if (!live.get().screens[displayId]) return reply.code(404).send({ error: 'unknown display' });

    const token = randomBytes(24).toString('base64url');
    const failed = await applySettings(reply, (s) => {
      s.screens[displayId] = { ...s.screens[displayId], token };
    });
    return failed ?? { ok: true, token };
  });

  // Stop requiring a token (a token written in config.yaml stays; it is the file's choice).
  app.delete('/api/admin/screens/:id/token', secured, async (req, reply) => {
    const displayId = req.params.id;
    if (!live.get().screens[displayId]) return reply.code(404).send({ error: 'unknown display' });

    const failed = await applySettings(reply, (s) => {
      const withoutToken = { ...s.screens[displayId] };
      delete withoutToken.token;
      s.screens[displayId] = withoutToken;
    });
    return failed ?? { ok: true, stillRequired: Boolean(live.get().screens[displayId].token) };
  });
}
