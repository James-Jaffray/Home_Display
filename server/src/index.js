import { loadConfig, ConfigError } from './config.js';
import { loadSettings } from './settings.js';
import { buildApp } from './app.js';

const settings = loadSettings();

// 1. Read and validate config.yaml. A mistake here should stop the server with a
//    readable message, not fail later in a confusing way.
let config;
try {
  config = loadConfig(settings.configPath);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

// 2. Build the app and start listening.
const app = await buildApp({
  config,
  photosDir: settings.photosDir,
  webDist: settings.webDist,
  version: settings.version,
  logger: { level: settings.logLevel },
});

try {
  await app.listen({ port: settings.port, host: settings.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// 3. One summary line: counts and names only, never URLs, tokens or event titles.
const health = (await app.inject('/api/health')).json();
app.log.info(
  {
    calendars: Object.keys(config.calendars).length,
    screens: Object.keys(config.screens),
    defaultScreen: config.defaultScreen,
    photosDir: settings.photosDir,
    photosReadable: health.photosReadable,
  },
  'config valid, Home-Display ready',
);

// 4. Shut down cleanly when Docker or the OS asks us to.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => app.close().then(() => process.exit(0)));
}
