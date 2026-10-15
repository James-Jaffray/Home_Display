const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** An auth problem. `code` is a short machine-readable reason; messages never contain tokens. */
export class GoogleAuthError extends Error {
  /** @param {string} code e.g. 'invalid_grant' (token revoked/expired), 'not_configured' */
  constructor(code) {
    super(`Google auth error: ${code}`);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

/**
 * Talks to Google's OAuth endpoints with plain fetch (no SDK needed).
 * @param {{clientId: string, clientSecret: string, redirectUri: string, fetchImpl?: typeof fetch}} options
 */
export function createGoogleOAuth({ clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const configured = Boolean(clientId && clientSecret);

  async function tokenRequest(params) {
    if (!configured) throw new GoogleAuthError('not_configured');
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // body.error is a short code like "invalid_grant"; the rest may be sensitive.
      throw new GoogleAuthError(typeof body.error === 'string' ? body.error : `http_${res.status}`);
    }
    return body;
  }

  return {
    configured,

    /** URL to send the user to for Google's consent screen. @param {string} state */
    authUrl(state) {
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        // offline + consent make Google return a refresh token every time.
        access_type: 'offline',
        prompt: 'consent',
        state,
      }).toString();
      return url.toString();
    },

    /** Swap the one-time code from the callback for tokens. @param {string} code */
    async exchangeCode(code) {
      const body = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      if (!body.refresh_token) throw new GoogleAuthError('no_refresh_token');
      return { refreshToken: body.refresh_token, accessToken: body.access_token, expiresInSec: body.expires_in };
    },

    /** Get a short-lived access token. @param {string} refreshToken */
    async refreshAccessToken(refreshToken) {
      const body = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
      return { accessToken: body.access_token, expiresInSec: body.expires_in };
    },
  };
}
