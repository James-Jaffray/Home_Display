# How Home-Display fits together

Read this first if you are new to the code. It is short on purpose.

## The big picture

```
 Browser (React)  ──fetch──▶  Fastify server  ──reads──▶  config.yaml
   web/                          server/                  /data (photos, later tokens)
```

- **`web/`** draws the screen. It never reads files or talks to Google; it only calls this
  app's own `/api` and `/photos`.
- **`server/`** owns everything private: config, photos, and (from slice 2) calendar tokens.
- In production there is **one container**: the server also serves the built `web/` files.

## Server (`server/src/`)

Read in this order:

| File | Job |
|---|---|
| `index.js` | Entry point. Load settings and config, build the app, start listening. |
| `settings.js` | Values from environment variables (port, folders). |
| `config.js` | Reads `config.yaml`, checks it strictly with zod, explains mistakes clearly. |
| `app.js` | Creates the Fastify server and plugs in the route files. |
| `routes/` | One file per topic. A route only turns a request into a response. |
| `services/` | The real logic. Routes call services. `photos.js` lists files safely; `calendarService.js` polls Google and caches events; `agenda.js` groups events by day in the screen timezone; `google/` talks to Google; `tokenStore.js` keeps refresh tokens in `/data`. |
| `routes/admin.js`, `routes/auth.js` | The dashboard API (login, settings, calendars, photos) and the Google connect flow. All need the admin session. |
| `services/settingsStore.js`, `liveConfig.js` | `settings.json` holds dashboard choices; `liveConfig` merges them over `config.yaml`. Everything reads `services.live.get()` per request, so changes apply instantly. |
| `services/adminAuth.js` | Password check, session cookie, lockout. |
| `services/index.js` | Builds the services once so `index.js` and the tests wire them the same way. |

Rule of thumb: **routes are thin, services do the work, nothing in `routes/` touches the
disk directly.** That keeps logic testable without starting a server.

Request flow for the agenda: a timer in `calendarService` asks Google for each calendar every 60 s and keeps the last good result. `GET /api/screens/:id/events` reads that cache and runs it through `agenda.js`; the browser never calls Google.

Request flow for a photo: `GET /photos/kitchen/a.jpg` → `routes/photos.js` finds the screen in
the config → `services/photos.js` checks the file name is safe and opens it → streamed back.

## Web (`web/src/`)

| Folder / file | Job |
|---|---|
| `main.jsx` | Starts React. |
| `App.jsx` | The wall display: picks the screen from the URL and shows it (or an error message). |
| `admin/` | The dashboard page (`/admin`), loaded on demand: login, screen settings, calendars, photos. |
| `components/` | Things you can see: `Clock`, `Slideshow`, `Agenda`. Mostly layout and styling. |
| `hooks/` | Things that fetch or tick: `useScreen`, `usePhotoList`, `useEvents`, `useNow`. |
| `lib/` | Small pure helpers (time formatting). |
| `index.css` | Tailwind plus the colour tokens. Components use tokens, never raw hex. |

## Conventions

- Plain JavaScript (ES modules), JSDoc on functions that handle important data.
- `npm run lint` and `npm test` must pass before a slice is called done.
- Tests live in `server/test/`, named after the file they cover.
- Secrets never go to the browser, the repo or the logs.
- Config is strict: unknown keys are errors.

See `ROADMAP.md` for the plan and the reasons behind decisions.
