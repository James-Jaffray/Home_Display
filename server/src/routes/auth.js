import { randomBytes } from 'node:crypto';
import { GoogleAuthError } from '../services/google/oauth.js';

const STATE_TTL_MS = 10 * 60_000;

/** Tiny standalone result page (account names are config ids: letters, digits, dashes). */
function resultPage(title, message, backLink = true) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>${title}</h1><p>${message}</p>${backLink ? '<p><a href="/admin">Back to the dashboard</a></p>' : ''}</body>`;
}

/**
 * Connect a Google account: /start sends you to Google, Google sends you back to
 * /callback with a one-time code, and we keep the resulting refresh token.
 *
 * /start needs a dashboard login (anyone who could open it could otherwise attach their
 * own Google account to one of your account names). /callback does not: it arrives from
 * Google, and the single-use `state` value proves it follows a logged-in /start.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>}} options
 */
export default async function authRoutes(app, { services }) {
  const { oauth, tokens, calendars, adminAuth, live } = services;
  /** state value -> {account, expires}. In memory only: a restart just means "try again". */
  const pending = new Map();

  function googleAccounts() {
    return new Set(
      Object.values(live.get().calendars)
        .filter((c) => c.provider === 'google')
        .map((c) => c.account),
    );
  }

  function guardConfigured(reply) {
    if (!oauth.configured) {
      reply
        .code(503)
        .type('text/html')
        .send(resultPage('Google is not configured', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.'));
      return false;
    }
    return true;
  }

  // GET /api/auth/google/start?account=james   (dashboard login required)
  app.get('/api/auth/google/start', async (req, reply) => {
    if (!adminAuth.isAuthenticated(req)) {
      return reply.code(401).type('text/html').send(resultPage('Sign in first', 'Open the dashboard and log in, then try again.'));
    }
    if (!guardConfigured(reply)) return reply;
    const { account } = req.query;
    if (!googleAccounts().has(account)) {
      return reply.code(400).type('text/html').send(resultPage('Unknown account', 'That account is not in config.yaml.'));
    }
    for (const [state, info] of pending) if (info.expires < Date.now()) pending.delete(state);

    // "state" ties the callback to this request, so a forged callback is rejected.
    const state = randomBytes(24).toString('base64url');
    pending.set(state, { account, expires: Date.now() + STATE_TTL_MS });
    return reply.redirect(oauth.authUrl(state));
  });

  // GET /api/auth/google/callback?code=...&state=...  (Google redirects here)
  app.get('/api/auth/google/callback', async (req, reply) => {
    if (!guardConfigured(reply)) return reply;
    const { code, state, error } = req.query;
    const info = pending.get(state);
    pending.delete(state); // single use
    if (!info || info.expires < Date.now()) {
      return reply.code(400).type('text/html').send(resultPage('Link expired', 'Please start the connection again.'));
    }
    if (error || !code) {
      return reply.code(400).type('text/html').send(resultPage('Not connected', 'Google access was not granted.'));
    }
    try {
      const { refreshToken } = await oauth.exchangeCode(code);
      await tokens.set(info.account, refreshToken);
      app.log.info({ account: info.account }, 'google account connected');
      calendars.refreshAccount(info.account); // fire and forget: the page need not wait
      return reply.type('text/html').send(resultPage('Connected', `Account “${info.account}” is connected.`));
    } catch (err) {
      const reason = err instanceof GoogleAuthError ? err.code : 'unexpected';
      app.log.warn({ account: info.account, reason }, 'google connect failed');
      return reply.code(502).type('text/html').send(resultPage('Could not connect', `Google returned: ${reason}.`));
    }
  });
}
