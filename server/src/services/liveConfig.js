import { validateConfig } from '../config.js';

/**
 * The configuration the app is actually using right now: config.yaml (the base) with the
 * dashboard's overrides (settings.json) laid on top.
 *
 * Routes and services call `live.get()` on every request instead of holding on to a
 * config object, so a dashboard change takes effect without a restart.
 *
 * If the merged result ever fails validation, the last good config keeps being served.
 *
 * @param {object} options
 * @param {import('../config.js').Config} options.baseConfig
 * @param {ReturnType<import('./settingsStore.js').createSettingsStore>} options.settingsStore
 */
export function createLiveConfig({ baseConfig, settingsStore }) {
  /** @param {import('./settingsStore.js').Settings} settings */
  function merge(settings) {
    const merged = structuredClone(baseConfig);

    // Displays made in the dashboard (config.yaml ones win if an id is ever in both).
    for (const [displayId, display] of Object.entries(settings.displays)) {
      if (!(displayId in merged.screens)) merged.screens[displayId] = structuredClone(display);
    }

    for (const [screenId, override] of Object.entries(settings.screens)) {
      const screen = merged.screens[screenId];
      if (!screen) continue; // screen was removed from config.yaml: ignore its overrides
      const { photoInterval, ...rest } = override;
      Object.assign(screen, rest);
      if (photoInterval !== undefined) screen.photos = { ...screen.photos, interval: photoInterval };
    }
    // Dashboard calendars never replace one that config.yaml already defines.
    for (const [calId, cal] of Object.entries(settings.calendars)) {
      if (!(calId in merged.calendars)) merged.calendars[calId] = cal;
    }
    // Re-validate: catches e.g. a screen pointing at a calendar that no longer exists.
    return validateConfig(merged, {});
  }

  let current = merge(settingsStore.get());

  return {
    /** @returns {import('../config.js').Config} */
    get() {
      return current;
    },

    /** Merge a candidate settings object without applying it. Throws ConfigError if invalid. */
    preview(settings) {
      return merge(settings);
    },

    /** Re-merge after settings changed. Keeps the last good config on failure. */
    refresh() {
      try {
        current = merge(settingsStore.get());
        return true;
      } catch {
        return false;
      }
    },
  };
}
