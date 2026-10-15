import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const COOKIE = 'hd_admin';

const digest = (text) => createHash('sha256').update(text).digest();

/**
 * One shared admin password, a random session id in an HttpOnly cookie.
 * No user accounts and no database: sessions live in memory, so a restart simply logs
 * everyone out. Repeated wrong passwords from one address are locked out for a while.
 *
 * @param {{password: string, secureCookie: boolean, now?: () => number}} options
 */
export function createAdminAuth({ password, secureCookie, now = Date.now }) {
  /** @type {Map<string, number>} session id -> expiry */
  const sessions = new Map();
  /** @type {Map<string, {count: number, until: number}>} ip -> failures */
  const failures = new Map();
  const expected = digest(password);

  function cookieValue(req) {
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === COOKIE) return rest.join('=');
    }
    return null;
  }

  return {
    /** The dashboard is off until ADMIN_PASSWORD is set. */
    enabled: Boolean(password),

    /**
     * @param {string} ip
     * @param {string} candidate
     * @returns {{ok: true, token: string} | {ok: false, locked: boolean}}
     */
    login(ip, candidate) {
      const record = failures.get(ip);
      if (record && record.count >= MAX_FAILURES && record.until > now()) return { ok: false, locked: true };

      // Hash both sides so the comparison is constant-time whatever the lengths.
      const good = typeof candidate === 'string' && timingSafeEqual(digest(candidate), expected);
      if (!good) {
        const count = (record && record.until > now() ? record.count : 0) + 1;
        failures.set(ip, { count, until: now() + LOCKOUT_MS });
        return { ok: false, locked: count >= MAX_FAILURES };
      }
      failures.delete(ip);
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, now() + SESSION_MS);
      return { ok: true, token };
    },

    /** @param {import('fastify').FastifyRequest} req */
    isAuthenticated(req) {
      const token = cookieValue(req);
      const expires = token ? sessions.get(token) : undefined;
      if (!expires) return false;
      if (expires < now()) {
        sessions.delete(token);
        return false;
      }
      return true;
    },

    /** @param {import('fastify').FastifyRequest} req */
    logout(req) {
      const token = cookieValue(req);
      if (token) sessions.delete(token);
    },

    sessionCookie(token) {
      return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secureCookie ? '; Secure' : ''}`;
    },

    clearCookie() {
      return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie ? '; Secure' : ''}`;
    },
  };
}
