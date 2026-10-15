import { isIP } from 'node:net';

/**
 * Is this IP address on a private network (home LAN, loopback, VPN)?
 * Anything else is treated as "the internet".
 *
 * @param {string} address  IPv4 or IPv6, possibly IPv4-mapped ("::ffff:192.168.1.5")
 * @returns {boolean}
 */
export function isPrivateAddress(address) {
  let ip = String(address ?? '').trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);

  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT range, used by Tailscale
    );
  }
  if (isIP(ip) === 6) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/.test(ip);
  }
  // Not an address at all: do not trust it.
  return false;
}

/**
 * Did this request come from outside the home network?
 *
 * We look at the connecting address AND the client addresses a proxy or tunnel reports
 * (Cloudflare sets CF-Connecting-IP and X-Forwarded-For). If any of them is a public
 * address, the request is external. A proxy on the home network reports a private
 * address, so it is still treated as local.
 *
 * Limit: a proxy that reports no client address at all cannot be told apart from a
 * local connection. Cloudflare Tunnel does report one.
 *
 * @param {import('fastify').FastifyRequest} req
 * @returns {boolean}
 */
export function isExternalRequest(req) {
  const candidates = [req.socket?.remoteAddress];

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) candidates.push(...String(forwardedFor).split(','));
  for (const header of ['cf-connecting-ip', 'x-real-ip', 'true-client-ip']) {
    if (req.headers[header]) candidates.push(String(req.headers[header]));
  }

  return candidates.filter(Boolean).some((address) => !isPrivateAddress(address));
}
