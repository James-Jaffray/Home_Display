import { buildAgenda, localDate, weekStartDate } from '../services/agenda.js';
import { displayGuard } from './displayGuard.js';

const MAX_DAYS = 14;
const MAX_WEEKS = 6;

/**
 * GET /api/screens/:id/events?days=7      N days starting today (list view)
 * GET /api/screens/:id/events?weeks=4     whole weeks starting at the screen's week start
 *                                         (month grid)
 *
 * The only public endpoint that returns event titles. It reads from the calendar cache,
 * so it is cheap, and it only ever includes calendars listed on that screen.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{services: ReturnType<import('../services/index.js').createServices>}} options
 */
export default async function eventRoutes(app, { services }) {
  app.get('/api/screens/:id/events', { preHandler: displayGuard(services) }, async (req, reply) => {
    const screen = services.live.get().screens[req.params.id];
    if (!screen) return reply.code(404).send({ error: 'unknown screen' });

    const nowMs = Date.now();
    let range;
    if (req.query.weeks !== undefined) {
      const weeks = Number(req.query.weeks);
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) {
        return reply.code(400).send({ error: `weeks must be a whole number from 1 to ${MAX_WEEKS}` });
      }
      const today = localDate(nowMs, screen.timezone);
      range = { days: weeks * 7, startDate: weekStartDate(today, screen.weekStart) };
    } else {
      const days = Number(req.query.days ?? 7);
      if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        return reply.code(400).send({ error: `days must be a whole number from 1 to ${MAX_DAYS}` });
      }
      range = { days };
    }

    const { calendars, events } = services.calendars.snapshot(screen.calendars);
    const agenda = buildAgenda({ events, timezone: screen.timezone, nowMs, ...range });

    return {
      generatedAt: new Date(nowMs).toISOString(),
      timezone: screen.timezone,
      ...agenda,
      calendars,
      // True when anything shown may be out of date or the screen needs attention.
      attention: calendars.some((c) => c.status !== 'ok'),
    };
  });
}
