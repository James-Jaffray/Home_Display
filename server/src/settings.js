import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Everything that comes from environment variables, in one place.
 * (Calendars, screens and other app settings come from config.yaml; see config.js.)
 */
export function loadSettings(env = process.env) {
  const dataDir = resolve(env.DATA_DIR ?? 'data');
  const { version } = JSON.parse(readFileSync(resolve(serverDir, 'package.json'), 'utf8'));
  return {
    version,
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    logLevel: env.LOG_LEVEL ?? 'info',
    configPath: resolve(env.CONFIG_PATH ?? 'config/config.yaml'),
    dataDir,
    photosDir: resolve(env.PHOTOS_DIR ?? `${dataDir}/photos`),
    webDist: resolve(env.WEB_DIST ?? resolve(serverDir, '../web/dist')),
  };
}
