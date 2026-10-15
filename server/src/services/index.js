import { createTokenStore } from './tokenStore.js';
import { createGoogleOAuth } from './google/oauth.js';
import { createCalendarService } from './calendarService.js';
import { createSettingsStore } from './settingsStore.js';
import { createLiveConfig } from './liveConfig.js';
import { createAdminAuth } from './adminAuth.js';
import { createDisplayAccess } from './displayAccess.js';

/**
 * Build the long-lived services once and hand them to the app. Keeping this in one place
 * means index.js and the tests wire things the same way.
 *
 * `live.get()` is the configuration to use for every request: config.yaml plus whatever
 * has been changed in the dashboard.
 *
 * @param {object} options
 * @param {import('../config.js').Config} options.config  validated config.yaml
 * @param {ReturnType<import('../settings.js').loadSettings>} options.settings
 * @param {{warn: Function, info: Function}} [options.log]
 * @param {typeof fetch} [options.fetchImpl]  replaced in tests so nothing hits Google
 */
export function createServices({ config, settings, log, fetchImpl }) {
  const tokens = createTokenStore(settings.dataDir);
  const settingsStore = createSettingsStore(settings.dataDir);
  const live = createLiveConfig({ baseConfig: config, settingsStore });
  const oauth = createGoogleOAuth({
    clientId: settings.google.clientId,
    clientSecret: settings.google.clientSecret,
    redirectUri: `${settings.publicBaseUrl}/api/auth/google/callback`,
    fetchImpl,
  });
  const calendars = createCalendarService({ getConfig: live.get, tokens, oauth, log, fetchImpl });
  const adminAuth = createAdminAuth({
    password: settings.adminPassword,
    secureCookie: settings.publicBaseUrl.startsWith('https://'),
  });

  const displayAccess = createDisplayAccess({ getConfig: live.get });

  /** Every Google account name: those used by config.yaml calendars plus dashboard-added ones. */
  function accountNames() {
    const names = new Set(settingsStore.get().accounts);
    for (const cal of Object.values(live.get().calendars)) {
      names.add(cal.account);
    }
    return [...names];
  }

  return {
    tokens,
    settingsStore,
    accountNames,
    live,
    oauth,
    calendars,
    adminAuth,
    displayAccess,
    /** Load saved dashboard settings from disk; call once at startup. */
    async init() {
      await settingsStore.init();
      live.refresh();
    },
  };
}
