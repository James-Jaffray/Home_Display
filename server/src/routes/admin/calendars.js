import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { color, id } from '../../config.js';

const addCalendarSchema = z.strictObject({
  account: id,
  calendarId: z.string().min(1).max(300),
  label: z.string().min(1).max(60),
  color,
  // Displays to show it on right away.
  screens: z.array(id).default([]),
});

/**
 * Add a Google calendar to the install (and optionally to some displays).
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerCalendarRoutes(app, { services, secured, applySettings }) {
  const { live, calendars } = services;

  app.post('/api/admin/calendars', secured, async (req, reply) => {
    const parsed = addCalendarSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid calendar' });

    const { screens: screenIds, ...cal } = parsed.data;
    if (!services.accountNames().includes(cal.account)) return reply.code(400).send({ error: 'unknown account' });
    const calId = `${cal.account}-${randomBytes(3).toString('hex')}`;

    const failed = await applySettings(reply, (s) => {
      s.calendars[calId] = cal;
      for (const screenId of screenIds) {
        const current = s.screens[screenId]?.calendars ?? live.get().screens[screenId]?.calendars ?? [];
        s.screens[screenId] = { ...s.screens[screenId], calendars: [...current, calId] };
      }
    });
    if (failed) return failed;

    calendars.refreshCalendar(calId); // start loading it now
    return { ok: true, id: calId };
  });
}
