import { timingSafeEqual } from 'node:crypto';
import { isExternalRequest } from './network.js';

/** Constant-time string comparison (so a wrong guess leaks nothing about the right one). */
function sameToken(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Decides who may read a display's data (its settings, events and photos).
 *
 *  - A display WITH a token: everyone needs the token (`?k=...`), at home or away.
 *  - A display WITHOUT a token: fine from the home network, refused when the request
 *    comes from outside (through a tunnel or a port-forward). That way exposing the
 *    server to the internet can never expose a calendar by accident.
 *
 * @param {{getConfig: () => import('../config.js').Config}} deps
 */
export function createDisplayAccess({ getConfig }) {
  return {
    /**
     * @param {import('fastify').FastifyRequest} req
     * @param {string} screenId
     * @returns {{ok: true} | {ok: false, status: number, error: string}}
     */
    check(req, screenId) {
      const screen = getConfig().screens[screenId];
      // Unknown displays are not our concern here; the route answers 404 itself.
      if (!screen) return { ok: true };

      if (screen.token) {
        if (sameToken(req.query?.k, screen.token)) return { ok: true };
        return { ok: false, status: 401, error: 'this display needs its access token' };
      }
      if (isExternalRequest(req)) {
        return {
          ok: false,
          status: 403,
          error: 'this display has no access token, so it can only be opened from the home network',
        };
      }
      return { ok: true };
    },
  };
}
