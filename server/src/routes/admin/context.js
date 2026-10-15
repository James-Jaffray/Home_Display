import { ConfigError } from '../../config.js';
import { createRequireAdmin } from '../requireAdmin.js';

// The browser shrinks photos to ~1920px before uploading; this is only a safety ceiling.
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
// Link icons are shrunk to 128px in the browser; they are tiny.
export const MAX_ICON_BYTES = 1024 * 1024;

/**
 * What every dashboard route file needs, built once and handed to each of them:
 * the services, folders, the "must be logged in" guard, and the one safe way to change
 * settings.
 *
 * @param {object} options
 * @param {ReturnType<import('../../services/index.js').createServices>} options.services
 * @param {string} options.photosDir
 * @param {string} options.iconsDir
 * @param {string} options.publicHost  host part of PUBLIC_BASE_URL (trusted by the same-site check)
 * @param {string} options.publicBaseUrl
 */
export function createAdminContext({ services, photosDir, iconsDir, publicHost, publicBaseUrl }) {
  const { adminAuth, settingsStore, live } = services;

  /** Route option object: protected routes use `{ ...secured }` (plus any other options). */
  const secured = { preHandler: createRequireAdmin({ adminAuth, publicHost }) };

  /**
   * Change settings.json safely: apply `mutate` to a copy, check that the merged result is
   * still a valid configuration, and only then save and use it. On a problem it answers the
   * request with a 400 and returns the reply; on success it returns null.
   *
   * @param {import('fastify').FastifyReply} reply
   * @param {(settings: object) => void} mutate
   */
  async function applySettings(reply, mutate) {
    const next = structuredClone(settingsStore.get());
    mutate(next);
    try {
      live.preview(settingsStore.parse(next));
    } catch (err) {
      const problems = err instanceof ConfigError ? err.problems : ['invalid settings'];
      return reply.code(400).send({ error: 'invalid settings', problems });
    }
    await settingsStore.replace(next);
    live.refresh();
    return null;
  }

  /** A zod error as short sentences ("links.0.url: must be a web address..."). */
  const problemsFrom = (zodError) => zodError.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

  return { services, photosDir, iconsDir, publicBaseUrl, secured, applySettings, problemsFrom };
}
