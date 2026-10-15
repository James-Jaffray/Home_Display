import { z } from 'zod';
import { id } from '../../config.js';
import { GoogleAuthError } from '../../services/google/oauth.js';

const addAccountSchema = z.strictObject({ account: id });

/**
 * Google account names: add one, disconnect one, and list the calendars an account can see.
 * (Connecting an account to Google itself is routes/auth.js.)
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {ReturnType<import('./context.js').createAdminContext>} ctx
 */
export default function registerAccountRoutes(app, { services, secured }) {
  const { settingsStore, live, calendars, tokens } = services;

  // Add a Google account NAME (e.g. "wife"). Connecting it is the separate sign-in step.
  app.post('/api/admin/accounts', secured, async (req, reply) => {
    const parsed = addAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'use lowercase letters, digits and dashes for the name' });
    }
    const { account } = parsed.data;
    if (services.accountNames().includes(account)) {
      return reply.code(409).send({ error: `there is already an account called "${account}"` });
    }
    await settingsStore.replace({ ...settingsStore.get(), accounts: [...settingsStore.get().accounts, account] });
    return { ok: true, account };
  });

  // Disconnect: forget the token. A dashboard-added name that no calendar uses is removed too.
  app.delete('/api/admin/accounts/:account', secured, async (req, reply) => {
    const { account } = req.params;
    if (!services.accountNames().includes(account)) return reply.code(404).send({ error: 'unknown account' });

    await tokens.delete(account);
    const inUse = Object.values(live.get().calendars).some((c) => c.account === account);
    const current = settingsStore.get();
    if (!inUse && current.accounts.includes(account)) {
      await settingsStore.replace({ ...current, accounts: current.accounts.filter((a) => a !== account) });
      live.refresh();
    }
    calendars.refreshAccount(account);
    return { ok: true };
  });

  // The calendars an account can see on Google (to pick from).
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
}
