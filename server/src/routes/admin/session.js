/**
 * Login, logout, and "am I logged in?". The only dashboard routes that need no session.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerSessionRoutes(app, { services }) {
  const { adminAuth } = services;

  app.get('/api/admin/session', async (req) => ({
    enabled: adminAuth.enabled,
    authenticated: adminAuth.enabled && adminAuth.isAuthenticated(req),
  }));

  app.post('/api/admin/login', async (req, reply) => {
    if (!adminAuth.enabled) return reply.code(503).send({ error: 'dashboard disabled: set ADMIN_PASSWORD' });

    const result = adminAuth.login(req.ip, req.body?.password);
    if (!result.ok) {
      const error = result.locked ? 'too many attempts, try later' : 'wrong password';
      return reply.code(result.locked ? 429 : 401).send({ error });
    }
    return reply.header('Set-Cookie', adminAuth.sessionCookie(result.token)).send({ ok: true });
  });

  app.post('/api/admin/logout', async (req, reply) => {
    adminAuth.logout(req);
    return reply.header('Set-Cookie', adminAuth.clearCookie()).send({ ok: true });
  });
}
