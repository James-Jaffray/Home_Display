# How Home-Display fits together

Read this first if you are new to the code. It is short on purpose.

## The big picture

```
 Browser (React)  ──fetch──▶  Fastify server  ──reads──▶  config.yaml
   web/                          server/                  /data (settings, tokens, photos, icons)
                                    │
                                    └──polls──▶  Google Calendar
```

- **`web/`** draws the screens and the dashboard. It never reads files or talks to Google; it
  only calls this app's own `/api`, `/photos` and `/icons`.
- **`server/`** owns everything private: config, Google tokens, photos and settings.
- In production there is **one container**: the server also serves the built `web/` files.

## Two pages, one app

| Address | What it is | Who uses it |
|---|---|---|
| `/display/<id>` | The wall display for one screen. View-only, no login. | A TV or Raspberry Pi in kiosk mode, or a browser homepage |
| `/admin` | The dashboard: displays, calendars, links, photos, access, accounts. Password protected. | You, from any browser |

A display is just a named set of settings (in `config.yaml` or created in the dashboard).
Several displays can show different calendars.

## Who can see what

| Thing | Rule |
|---|---|
| `/admin` and `/api/admin/*` | Admin password (session cookie). Always. |
| A display's data (`/api/screens/:id*`, `/photos/*`, `/icons/*`) | If the display has a token: the token (`?k=`), from anywhere. If not: only from the home network; requests from public addresses are refused. See `services/displayAccess.js` and `services/network.js`. |
| `/api/health`, `/api/default-screen` | Open; they reveal nothing about calendars. |

## Where settings come from

`config.yaml` is the read-only starting point. The dashboard saves its choices to
`/data/settings.json`. `services/liveConfig.js` lays the second over the first, and every
route calls `services.live.get()` for the current result, so a dashboard change applies at
once with no restart.

## Server (`server/src/`)

Read in this order:

| File | Job |
|---|---|
| `index.js` | Entry point. Load settings and config, build the app, start listening. |
| `settings.js` | Values from environment variables (port, folders, secrets). |
| `config.js` | Reads `config.yaml` and defines the strict schemas for displays, links and calendars. |
| `app.js` | Creates the Fastify server, adds safe response headers, plugs in the route files. |
| `routes/` | One file per topic; a route only turns a request into a response. |
| `routes/admin/` | The dashboard API, one file per topic: `session`, `overview`, `displays`, `tokens`, `images`, `accounts`, `calendars`. `context.js` holds what they share (the login guard and the one safe way to change settings). |
| `routes/auth.js` | The Google sign-in flow (and the "paste the address" fallback). |
| `services/` | The real logic. Routes call services. |

The services:

| Service | Job |
|---|---|
| `index.js` | Builds all the services once, so the app and the tests wire them the same way. |
| `calendarService.js` | Polls Google for each calendar, keeps the last good result, reports status. |
| `agenda.js` | Groups events by day in the display's timezone (never the server's or browser's). |
| `google/` | Talks to Google: OAuth (`oauth.js`) and the Calendar API (`calendarApi.js`). |
| `tokenStore.js` | Google refresh tokens in `/data/tokens.json`. |
| `settingsStore.js`, `liveConfig.js` | Dashboard choices, and the merge over `config.yaml`. |
| `adminAuth.js` | Password check, session cookie, lockout. |
| `displayAccess.js`, `network.js` | The rule for who may read a display (token, home network). |
| `photos.js`, `linkIcons.js` | Safe file handling for photos and link-button icons. |
| `atomicFile.js` | Crash-safe file writes and a queue so writes never overlap. |

Rule of thumb: **routes are thin, services do the work.** That keeps logic testable without
starting a server.

Request flow for the agenda: a timer in `calendarService` asks Google for each calendar every
60 s and keeps the last good result. `GET /api/screens/:id/events` reads that cache and runs it
through `agenda.js`; the browser never calls Google.

Request flow for a photo: `GET /photos/kitchen/a.jpg` → the display guard checks the token or
network rule → `routes/photos.js` finds the display → `services/photos.js` checks the file name
is safe and streams it.

## Web (`web/src/`)

| Folder / file | Job |
|---|---|
| `main.jsx` | Starts React; opens the dashboard for `/admin`, otherwise the display. |
| `App.jsx` | The wall display page: picks the display from the URL, loads it, shows it. |
| `layouts/` | One file per layout (`MonthLayout`, `WeekLayout`, `SplitLayout`, `ListLayout`). `DisplayLayout` picks one from the display's `layout` setting and adds the frame, link buttons and search bar. To add a layout: make a file here and add it to the map in `DisplayLayout.jsx`. |
| `components/` | What you see on a display: `Clock`, `Slideshow`, `MonthGrid`, `WeekList`, `Agenda`, `LinkButtons`, `SearchBox`, `DayDetail`. `Stage` is the box everything is drawn in; it sizes things in container units (`cqw`/`cqh`) and can rotate the whole picture. |
| `hooks/` | Things that fetch or tick: `useScreen`, `useScreenId`, `usePhotoList`, `useEvents`, `useNow`, `useAutoReload`. |
| `lib/` | Small helpers: time formatting, icons, the access token, `dayButton`. |
| `admin/` | The dashboard, loaded on demand with its own `admin.css`. See below. |
| `index.css` | Tailwind plus the colour tokens. Components use tokens, never raw hex. |

The dashboard (`web/src/admin/`):

| File | Job |
|---|---|
| `AdminApp.jsx` | Checks you are logged in; shows the login page or the dashboard. |
| `Dashboard.jsx` | The header, tabs and live `Preview`; loads the overview. |
| `DisplaySettings.jsx` | Holds one display's form state (`useDisplayForm.js`) and shows the section for the open tab. |
| `sections/` | One file per tab: `LookSection`, `CalendarsSection`, `LinksSection`, `PhotosSection`, `AccessSection`. |
| `Accounts.jsx` | Google accounts, adding a person, and the paste-the-address fallback. |
| smaller pieces | `CalendarPicker`, `LinksEditor`, `Photos`, `LayoutPicker`, `Segmented`, `TimezoneSelect`, `SectionHeader`, `Header`, `Tabs`, `Preview`, `AddDisplay`. |

## Conventions

- Plain JavaScript (ES modules), JSDoc on functions that handle important data.
- `npm run lint`, `npm test` and `npm run build` must pass.
- Tests live in `server/test/`, named after the topic they cover, and use a temporary data folder.
- Secrets never go to the browser, the repo or the logs.
- Config is strict: unknown keys are errors.
- Everything the app stores lives under `/data`.

See `ROADMAP.md` for the plan and the reasons behind decisions, and `CONTRIBUTING.md` before
sending changes.
