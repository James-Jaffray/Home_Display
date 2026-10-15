import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('..', import.meta.url));
// Defaults are relative to the project, not the shell's current folder, so `npm run dev`
// behaves the same wherever it is started from. Docker sets the paths explicitly.
const projectRoot = resolve(serverDir, '..');

/**
 * Everything that comes from environment variables, in one place.
 * (Calendars, screens and other app settings come from config.yaml; see config.js.)
 */
export function loadSettings(env = process.env) {
  const dataDir = resolve(env.DATA_DIR ?? resolve(projectRoot, 'data'));
  const port = Number(env.PORT ?? 8080);
  const { version } = JSON.parse(readFileSync(resolve(serverDir, 'package.json'), 'utf8'));
  return {
    version,
    port,
    host: env.HOST ?? '0.0.0.0',
    logLevel: env.LOG_LEVEL ?? 'info',
    configPath: resolve(env.CONFIG_PATH ?? resolve(projectRoot, 'config/config.yaml')),
    dataDir,
    photosDir: resolve(env.PHOTOS_DIR ?? `${dataDir}/photos`),
    iconsDir: resolve(env.ICONS_DIR ?? `${dataDir}/icons`),
    webDist: resolve(env.WEB_DIST ?? resolve(serverDir, '../web/dist')),
    // Where browsers reach this app. Must match the redirect URI registered in Google.
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    },
    // Password for the /admin dashboard. Empty = dashboard disabled.
    adminPassword: env.ADMIN_PASSWORD ?? '',
  };
}
