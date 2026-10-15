/**
 * A display can require an access token. Its address then looks like
 * /display/kitchen?k=<token>, and every request the page makes carries the same `k`.
 * (Photos are loaded by the browser as images, which cannot send custom headers, so the
 * token travels in the address.)
 */
const token = new URLSearchParams(window.location.search).get('k');

/**
 * Add the token (if this page has one) to a URL for this app's own API or photos.
 * @param {string} url  e.g. "/api/screens/kitchen/events?weeks=4"
 */
export function withToken(url) {
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(token)}`;
}
