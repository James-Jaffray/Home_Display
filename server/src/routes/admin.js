import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ConfigError, color, id } from '../config.js';
import { screenOverrideSchema } from '../services/settingsStore.js';
import { deletePhoto, listPhotos, photoFolder, savePhoto } from '../services/photos.js';
import { GoogleAuthError } from '../services/google/oauth.js';

// The browser shrinks photos to ~1920px before uploading; this is only a safety ceiling.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const addCalendarSchema = z.strictObject({
  account: id,
  calendarId: z.string().min(1).max(300),
  label: z.string().min(1).max(60),
  color,
  // Screens to show it on right away.
  screens: z.array(id).default([]),
});

/**
 * The dashboard's API. Everything except login and "am I logged in?" needs a session.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>, photosDir: string}} options
 */
export default async function adminRoutes(app, { services, photosDir }) {
  const { adminAuth, settingsStore, live, calendars, tokens } = services;

  // Raw image bodies (the dashboard PUTs the file itself, so no multipart parser needed).
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );

  /** preHandler for every protected route. */
  async function requireAdmin(req, reply) {
    if (!adminAuth.enabled) {
      return reply.code(503).send({ error: 'dashboard disabled: set ADMIN_PASSWORD' });
    }
    if (!adminAuth.isAuthenticated(req)) return reply.code(401).send({ error: 'login required' });
    // Browsers always send Origin on cross-site writes; refuse if it is not this site.
    const origin = req.headers.origin;
    if (req.method !== 'GET' && origin && new URL(origin).host !== req.headers.host) {
      return reply.code(403).send({ error: 'cross-site request refused' });
    }
    return undefined;
  }
  const secured = { preHandler: requireAdmin };

  /** Changes to apply to settings.json: validate the merged result, then save and apply. */
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

  // ---- session ---------------------------------------------------------------

  app.get('/api/admin/session', async (req) => ({
    enabled: adminAuth.enabled,
    authenticated: adminAuth.enabled && adminAuth.isAuthenticated(req),
  }));

  app.post('/api/admin/login', async (req, reply) => {
    if (!adminAuth.enabled) return reply.code(503).send({ error: 'dashboard disabled: set ADMIN_PASSWORD' });
    const result = adminAuth.login(req.ip, req.body?.password);
    if (!result.ok) {
      return reply.code(result.locked ? 429 : 401).send({ error: result.locked ? 'too many attempts, try later' : 'wrong password' });
    }
    return reply.header('Set-Cookie', adminAuth.sessionCookie(result.token)).send({ ok: true });
  });

  app.post('/api/admin/logout', async (req, reply) => {
    adminAuth.logout(req);
    return reply.header('Set-Cookie', adminAuth.clearCookie()).send({ ok: true });
  });

  // ---- overview --------------------------------------------------------------

  app.get('/api/admin/overview', secured, async () => {
    const config = live.get();
    const added = settingsStore.get().calendars;
    const statuses = Object.fromEntries(
      calendars.snapshot(Object.keys(config.calendars)).calendars.map((c) => [c.id, c.status]),
    );

    const screens = await Promise.all(
      Object.entries(config.screens).map(async ([screenId, screen]) => {
        const names = await listPhotos(photosDir, photoFolder(screenId, screen));
        return {
          id: screenId,
          title: screen.title,
          layout: screen.layout,
          weeks: screen.weeks,
          weekStart: screen.weekStart,
          clock: screen.clock,
          fontScale: screen.fontScale,
          photoInterval: screen.photos.interval,
          calendars: screen.calendars,
          photos: names.map((name) => ({ name, url: `/photos/${screenId}/${encodeURIComponent(name)}` })),
        };
      }),
    );

    const accountNames = [
      ...new Set(Object.values(config.calendars).filter((c) => c.provider === 'google').map((c) => c.account)),
    ];
    const accounts = await Promise.all(
      accountNames.map(async (account) => ({ account, connected: Boolean(await tokens.get(account)) })),
    );

    return {
      googleConfigured: services.oauth.configured,
      screens,
      accounts,
      calendars: Object.entries(config.calendars).map(([calId, cal]) => ({
        id: calId,
        label: cal.label,
        color: cal.color,
        provider: cal.provider,
        account: cal.account ?? null,
        status: statuses[calId] ?? 'pending',
        // Only dashboard-added calendars can be removed from the dashboard.
        removable: calId in added,
      })),
    };
  });

  // ---- screen settings -------------------------------------------------------

  app.patch('/api/admin/screens/:id', secured, async (req, reply) => {
    const screenId = req.params.id;
    if (!live.get().screens[screenId]) return reply.code(404).send({ error: 'unknown screen' });
    const parsed = screenOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid settings', problems: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    }
    const failed = await applySettings(reply, (s) => {
      s.screens[screenId] = { ...s.screens[screenId], ...parsed.data };
    });
    return failed ?? { ok: true };
  });

  // ---- calendars -------------------------------------------------------------

  // Calendars an account can see on Google (to pick from).
  app.get('/api/admin/accounts/:account/calendars', secured, async (req, reply) => {
    try {
      return { calendars: await calendars.listAccountCalendars(req.params.account) };
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        return reply.code(409).send({ error: err.code === 'not_connected' ? 'account not connected' : 'reconnect needed' });
      }
      return reply.code(502).send({ error: 'Google request failed' });
    }
  });

  app.post('/api/admin/calendars', secured, async (req, reply) => {
    const parsed = addCalendarSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid calendar' });
    const { screens: screenIds, ...cal } = parsed.data;
    const calId = `${cal.account}-${randomBytes(3).toString('hex')}`;

    const failed = await applySettings(reply, (s) => {
      s.calendars[calId] = { provider: 'google', ...cal };
      for (const screenId of screenIds) {
        const current = s.screens[screenId]?.calendars ?? live.get().screens[screenId]?.calendars ?? [];
        s.screens[screenId] = { ...s.screens[screenId], calendars: [...current, calId] };
      }
    });
    if (failed) return failed;
    calendars.refreshCalendar(calId); // start loading it now
    return { ok: true, id: calId };
  });

  app.delete('/api/admin/calendars/:id', secured, async (req, reply) => {
    const calId = req.params.id;
    if (!(calId in settingsStore.get().calendars)) {
      return reply.code(400).send({ error: 'only calendars added in the dashboard can be removed here' });
    }
    const failed = await applySettings(reply, (s) => {
      delete s.calendars[calId];
      for (const [screenId, override] of Object.entries(s.screens)) {
        if (override.calendars) s.screens[screenId] = { ...override, calendars: override.calendars.filter((c) => c !== calId) };
      }
      // A screen that has no override yet but lists this calendar in config.yaml cannot exist
      // (dashboard calendars are never in config.yaml), so nothing else to clean up.
    });
    return failed ?? { ok: true };
  });

  // ---- photos ----------------------------------------------------------------

  app.post('/api/admin/screens/:id/photos', { ...secured, bodyLimit: MAX_UPLOAD_BYTES }, async (req, reply) => {
    const screen = live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ error: 'send the image as the request body (jpeg, png or webp)' });
    const name = await savePhoto(photosDir, photoFolder(req.params.id, screen), req.body);
    if (!name) return reply.code(415).send({ error: 'not a supported image' });
    return { ok: true, name, url: `/photos/${req.params.id}/${encodeURIComponent(name)}` };
  });

  app.delete('/api/admin/screens/:id/photos/:name', secured, async (req, reply) => {
    const screen = live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });
    const ok = await deletePhoto(photosDir, photoFolder(req.params.id, screen), req.params.name);
    return ok ? { ok: true } : reply.code(404).send({ error: 'not found' });
  });
}
