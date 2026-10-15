import { loadConfig, ConfigError } from './config.js';
import { loadSettings } from './settings.js';
import { createServices } from './services/index.js';
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

// 2. Build the services and the app. Services log through the app's logger; the wrapper
//    looks `app` up at call time, which is after it exists.
const log = {
  info: (...args) => app.log.info(...args),
  warn: (...args) => app.log.warn(...args),
};
const services = createServices({ config, settings, log });
await services.init(); // load saved dashboard settings
const app = await buildApp({ settings, services, logger: { level: settings.logLevel } });

// 3. Start listening, then start polling Google.
try {
  await app.listen({ port: settings.port, host: settings.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
services.calendars.start();

// 4. One summary line: counts and names only, never URLs, tokens or event titles.
const health = (await app.inject('/api/health')).json();
app.log.info(
  {
    calendars: Object.keys(services.live.get().calendars).length,
    screens: Object.keys(services.live.get().screens),
    defaultScreen: services.live.get().defaultScreen,
    photosDir: settings.photosDir,
    photosReadable: health.photosReadable,
    googleConfigured: services.oauth.configured,
    dashboardEnabled: services.adminAuth.enabled,
  },
  'config valid, Home-Display ready',
);

// 5. Shut down cleanly when Docker or the OS asks us to.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    services.calendars.stop();
    app.close().then(() => process.exit(0));
  });
}
