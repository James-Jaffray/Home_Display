/**
 * preHandler that applies a display's access rule (token / home-network-only) to a route.
 * Used on every route that returns a display's settings, events or photos.
 *
 * @param {ReturnType<import('../services/index.js').createServices>} services
 * @param {string} [param]  name of the route parameter that holds the display id
 */
export function displayGuard(services, param = 'id') {
  return async function guard(req, reply) {
    const verdict = services.displayAccess.check(req, req.params[param]);
    if (!verdict.ok) return reply.code(verdict.status).send({ error: verdict.error });
    return undefined;
  };
}
