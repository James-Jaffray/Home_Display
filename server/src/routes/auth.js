import { randomBytes } from 'node:crypto';
import { GoogleAuthError } from '../services/google/oauth.js';
import { createRequireAdmin } from './requireAdmin.js';

const STATE_TTL_MS = 10 * 60_000;

/** Tiny standalone result page (account names are config ids: letters, digits, dashes). */
function resultPage(title, message) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>${title}</h1><p>${message}</p><p><a href="/admin">Back to the dashboard</a></p></body>`;
}

/**
 * Connect a Google account: /start sends you to Google, Google sends you back to
 * /callback with a one-time code, and we keep the resulting refresh token.
 *
 * Two ways the code can arrive:
 *  - Normally Google redirects the browser straight to /callback.
 *  - If this server is only reachable on the home network, Google's redirect (which must
 *    be https or localhost) lands on a page that cannot load. The user then copies that
 *    address from the address bar and pastes it into the dashboard, which posts it to
 *    /complete. Both paths run the same `finish` below.
 *
 * /start and /complete need a dashboard login. /callback does not: it arrives from
 * Google, and the single-use `state` value proves it follows a logged-in /start.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, publicHost: string}} options
 */
export default async function authRoutes(app, { services, publicHost }) {
  const { oauth, tokens, calendars, adminAuth } = services;
  const requireAdmin = createRequireAdmin({ adminAuth, publicHost });
  /** state value -> {account, expires}. In memory only: a restart just means "try again". */
  const pending = new Map();

  /**
   * Turn Google's answer into stored tokens.
   * @param {{code?: string, state?: string, error?: string}} answer
   * @returns {Promise<{status: number, title: string, message: string, account?: string, email?: string|null}>}
   */
  async function finish({ code, state, error }) {
    const info = pending.get(state);
    pending.delete(state); // single use
    if (!info || info.expires < Date.now()) {
      return { status: 400, title: 'Link expired', message: 'Please start the connection again.' };
    }
    if (error || !code) {
      return { status: 400, title: 'Not connected', message: 'Google access was not granted.' };
    }
    try {
      const { refreshToken, accessToken } = await oauth.exchangeCode(code);

      // Which Google address is this? (The primary calendar's id is the address.) It lets the
      // dashboard show who each name is and stops the same person being connected twice.
      const email = await calendars.primaryAddress(accessToken);
      const existing = email ? await tokens.accountWithEmail(email) : null;
      if (existing && existing !== info.account) {
        return {
          status: 409,
          title: 'Already connected',
          message: `${email} is already connected as “${existing}”. Nothing was changed.`,
        };
      }

      await tokens.set(info.account, refreshToken, { email });
      app.log.info({ account: info.account }, 'google account connected');
      calendars.refreshAccount(info.account); // fire and forget: nobody needs to wait
      return { status: 200, title: 'Connected', message: `Account “${info.account}” is connected.`, account: info.account, email };
    } catch (err) {
      const reason = err instanceof GoogleAuthError ? err.code : 'unexpected';
      app.log.warn({ account: info.account, reason }, 'google connect failed');
      return { status: 502, title: 'Could not connect', message: `Google returned: ${reason}.` };
    }
  }

  function guardConfigured(reply, asJson = false) {
    if (oauth.configured) return true;
    const message = 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.';
    if (asJson) reply.code(503).send({ error: message });
    else reply.code(503).type('text/html').send(resultPage('Google is not configured', message));
    return false;
  }

  // GET /api/auth/google/start?account=james   (dashboard login required)
  app.get('/api/auth/google/start', async (req, reply) => {
    if (!adminAuth.isAuthenticated(req)) {
      return reply.code(401).type('text/html').send(resultPage('Sign in first', 'Open the dashboard and log in, then try again.'));
    }
    if (!guardConfigured(reply)) return reply;
    const { account } = req.query;
    if (!services.accountNames().includes(account)) {
      return reply.code(400).type('text/html').send(resultPage('Unknown account', 'That account is not in config.yaml.'));
    }
    for (const [state, info] of pending) if (info.expires < Date.now()) pending.delete(state);

    // "state" ties the answer to this request, so a forged one is rejected.
    const state = randomBytes(24).toString('base64url');
    pending.set(state, { account, expires: Date.now() + STATE_TTL_MS });
    return reply.redirect(oauth.authUrl(state));
  });

  // GET /api/auth/google/callback?code=...&state=...  (Google redirects here)
  app.get('/api/auth/google/callback', async (req, reply) => {
    if (!guardConfigured(reply)) return reply;
    const result = await finish(req.query);
    return reply.code(result.status).type('text/html').send(resultPage(result.title, result.message));
  });

  // POST /api/auth/google/complete  { "url": "<address copied from the browser>" }
  app.post('/api/auth/google/complete', { preHandler: requireAdmin }, async (req, reply) => {
    if (!guardConfigured(reply, true)) return reply;
    const text = String(req.body?.url ?? '').trim();

    let params;
    try {
      // Accept a full address, or just the part after the "?".
      params = new URL(text.includes('://') ? text : `http://x/?${text.replace(/^\?/, '')}`).searchParams;
    } catch {
      return reply.code(400).send({ error: 'That does not look like an address. Copy the whole address bar.' });
    }
    if (!params.get('code') && !params.get('error')) {
      return reply.code(400).send({ error: 'No sign-in code found. Copy the address of the page Google sent you to.' });
    }

    const result = await finish({ code: params.get('code'), state: params.get('state'), error: params.get('error') });
    if (result.status !== 200) return reply.code(result.status).send({ error: result.message });
    return { ok: true, account: result.account, email: result.email };
  });
}
