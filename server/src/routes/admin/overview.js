import { listPhotos, photoFolder } from '../../services/photos.js';

/** Add the display's access token to a picture address so the dashboard can show it. */
function withKey(url, token) {
  return token ? `${url}?k=${encodeURIComponent(token)}` : url;
}

/**
 * GET /api/admin/overview: everything the dashboard shows, in one request.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerOverviewRoutes(app, { services, photosDir, publicBaseUrl, secured }) {
  const { settingsStore, live, calendars, tokens } = services;

  app.get('/api/admin/overview', secured, async () => {
    const config = live.get();
    const statuses = Object.fromEntries(
      calendars.snapshot(Object.keys(config.calendars)).calendars.map((c) => [c.id, c.status]),
    );

    const screens = await Promise.all(
      Object.entries(config.screens).map(async ([displayId, screen]) => {
        const names = await listPhotos(photosDir, photoFolder(displayId, screen));
        return {
          id: displayId,
          title: screen.title,
          timezone: screen.timezone,
          // Displays made in the dashboard can be deleted from it; config.yaml ones cannot.
          removable: displayId in settingsStore.get().displays,
          layout: screen.layout,
          weeks: screen.weeks,
          weekStart: screen.weekStart,
          clock: screen.clock,
          fontScale: screen.fontScale,
          rotate: screen.rotate,
          mode: screen.mode,
          search: screen.search,
          searchPosition: screen.searchPosition,
          photoInterval: screen.photos.interval,
          // Shown to the owner so the address with ?k=... can be copied to a TV or Pi.
          token: screen.token ?? null,
          tokenSource: !screen.token ? null : settingsStore.get().screens[displayId]?.token ? 'dashboard' : 'config',
          calendars: screen.calendars,
          links: screen.links,
          linksPosition: screen.linksPosition,
          // Pictures are guarded like the display itself, so the owner's thumbnails carry the token.
          photos: names.map((name) => ({
            name,
            url: withKey(`/photos/${displayId}/${encodeURIComponent(name)}`, screen.token),
          })),
        };
      }),
    );

    const accounts = await Promise.all(
      services.accountNames().map(async (account) => ({
        account,
        connected: Boolean(await tokens.get(account)),
        email: await tokens.email(account),
      })),
    );

    return {
      googleConfigured: services.oauth.configured,
      // Where Google sends people back to after sign-in, and the address this install is meant
      // to be reached at. The dashboard uses them to explain the "paste the address" step.
      publicBaseUrl,
      redirectUri: `${publicBaseUrl}/api/auth/google/callback`,
      screens,
      accounts,
      calendars: Object.entries(config.calendars).map(([calId, cal]) => ({
        id: calId,
        label: cal.label,
        color: cal.color,
        calendarId: cal.calendarId,
        account: cal.account,
        status: statuses[calId] ?? 'pending',
      })),
    };
  });
}
