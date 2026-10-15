import { MAX_UPLOAD_BYTES, createAdminContext } from './context.js';
import registerSessionRoutes from './session.js';
import registerOverviewRoutes from './overview.js';
import registerDisplayRoutes from './displays.js';
import registerTokenRoutes from './tokens.js';
import registerImageRoutes from './images.js';
import registerAccountRoutes from './accounts.js';
import registerCalendarRoutes from './calendars.js';

/**
 * The dashboard's API, one file per topic. Everything except login and "am I logged in?"
 * needs a session. Each file registers its own routes and shares the context built here.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {Parameters<typeof createAdminContext>[0]} options
 */
export default async function adminRoutes(app, options) {
  const ctx = createAdminContext(options);

  // Raw image bodies (the dashboard sends the file itself, so no multipart parser is needed).
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );

  registerSessionRoutes(app, ctx);
  registerOverviewRoutes(app, ctx);
  registerDisplayRoutes(app, ctx);
  registerTokenRoutes(app, ctx);
  registerImageRoutes(app, ctx);
  registerAccountRoutes(app, ctx);
  registerCalendarRoutes(app, ctx);
}
