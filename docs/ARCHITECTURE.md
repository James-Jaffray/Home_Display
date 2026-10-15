# How kitchen-display fits together

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
| `services/` | The real logic (e.g. listing photos safely). Routes call services. |

Rule of thumb: **routes are thin, services do the work, nothing in `routes/` touches the
disk directly.** That keeps logic testable without starting a server.

Request flow for a photo: `GET /photos/kitchen/a.jpg` → `routes/photos.js` finds the screen in
the config → `services/photos.js` checks the file name is safe and opens it → streamed back.

## Web (`web/src/`)

| Folder / file | Job |
|---|---|
| `main.jsx` | Starts React. |
| `App.jsx` | Picks the screen from the URL and shows it (or an error message). |
| `components/` | Things you can see: `Clock`, `Slideshow`. Mostly layout and styling. |
| `hooks/` | Things that fetch or tick: `useScreen`, `usePhotoList`, `useNow`. |
| `index.css` | Tailwind plus the colour tokens. Components use tokens, never raw hex. |

## Conventions

- Plain JavaScript (ES modules), JSDoc on functions that handle important data.
- `npm run lint` and `npm test` must pass before a slice is called done.
- Tests live in `server/test/`, named after the file they cover.
- Secrets never go to the browser, the repo or the logs.
- Config is strict: unknown keys are errors.

See `ROADMAP.md` for the plan and the reasons behind decisions.
