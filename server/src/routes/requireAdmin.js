/**
 * Build the preHandler that protects dashboard-only routes: a valid admin session, and for
 * writes, a same-site Origin (so another website cannot drive your logged-in dashboard).
 *
 * @param {{adminAuth: ReturnType<import('../services/adminAuth.js').createAdminAuth>, publicHost: string}} deps
 */
export function createRequireAdmin({ adminAuth, publicHost }) {
  return async function requireAdmin(req, reply) {
    if (!adminAuth.enabled) {
      return reply.code(503).send({ error: 'dashboard disabled: set ADMIN_PASSWORD' });
    }
    if (!adminAuth.isAuthenticated(req)) return reply.code(401).send({ error: 'login required' });

    // Browsers always send Origin on cross-site writes; refuse if it is not this site.
    // "This site" is the Host the request arrived on, the host a reverse proxy says it
    // forwarded (the dev server and tunnels rewrite Host), or the configured public URL.
    // A cross-site page cannot set those headers, so only the real Origin can match.
    const origin = req.headers.origin;
    if (req.method !== 'GET' && origin) {
      const allowed = [req.headers.host, req.headers['x-forwarded-host'], publicHost];
      if (!allowed.includes(new URL(origin).host)) {
        return reply.code(403).send({ error: 'cross-site request refused' });
      }
    }
    return undefined;
  };
}
