# Home-Display: Project Brief and Roadmap

Hand this file to Claude Code. Put it in the repo root as `ROADMAP.md`, and a short version
of "Ground rules" as `CLAUDE.md` if you want it applied automatically every session.

Working name: **Home-Display** (rename freely before the first commit; the repo name,
image name and README all derive from it).

> **Revision 2 (after James answered section 9).** Four answers changed the plan:
> near-real-time calendars (OAuth becomes the main path), parents on James's server (screens
> must be protected), parents supplying passwords (we never take passwords; Google sign-in
> consent instead), and an admin UI with photo upload (the app now keeps a little state).
> Changes are marked **[rev2]**. See section 9 for the decisions and their consequences.

---

## 1. What we're building

A self-hosted wall-display / browser-homepage app that replaces the paid DAKboard
subscription: a Google Calendar agenda (multiple accounts), a clock, and a photo
background, laid out for a portrait kitchen screen. It is a **separate project from
`homelab-dash`**. It is meant to be shared on GitHub (**public repo from day one**), so other
people can run their own copy with their own Google accounts using a short
`docker-compose.yml`.

**It does these things:**
1. Shows a clock, a photo-slideshow background and a calendar agenda on a screen.
2. Merges events from several Google calendars (several accounts) with a colour per calendar,
   **as close to real time as the Google Calendar API allows. [rev2]**
3. Serves several named **screens** from one install (e.g. `kitchen`, `parents`), each with
   its own calendars, photos and layout.
4. **[rev2]** Has a small **admin UI** to connect Google accounts, assign calendars to
   screens, pick a layout and upload a background photo per screen.
5. Runs as one container, on a Raspberry Pi (kiosk) or on a server, and also works as a
   normal browser homepage on a desktop.

**Current DAKboard usage being replaced:** Google Calendar with multiple accounts, portrait
screen, photo background, clock, running on a Raspberry Pi 5 over HDMI to an old TV.

**Out of scope for now:** other calendar providers (Outlook, Apple), weather and any other
extra tiles (James: "no extra features"), multi-user accounts / sign-up, touch interaction on
the display. See "Later".

---

## 2. Ground rules (non-negotiable)

- **Plain JavaScript, ES modules. No TypeScript.** JSDoc on functions that handle calendar
  data. ESLint (flat config) with `npm run lint` in every package.
- **Stack:** React 19 + Vite + Tailwind v4 (frontend), Node 22 + Fastify 5 (backend), `yaml`
  + `zod` for config. Don't add big dependencies without saying why. Prefer the standard
  library. Expected additions are an iCal parser, a Google API client (or plain `fetch`
  against the REST API, preferred), and (maybe) an image resizer; see slices.
- **One container.** Fastify serves the API and the built frontend. Multi-stage Dockerfile.
  The published image is **multi-arch (linux/amd64 and linux/arm64)** so it runs on a Pi.
- **Minimal state, in one place. [rev2]** No database. All mutable state lives under a single
  mounted `/data` volume as plain files: OAuth refresh tokens, admin-UI settings, uploaded
  photos. `config.yaml` stays read-only and holds only what the app needs to boot. Anything
  beyond that (a database, per-user accounts) needs asking first.
- **Secrets never reach the browser or the repo.** Calendar URLs, OAuth client secret,
  refresh tokens and API keys stay on the server. The browser only talks to this app's own
  `/api`. Ship `config.example.yaml` and `.env.example`; gitignore the real ones and `/data`.
- **We never see or store anyone's Google password. [rev2]** Accounts are connected through
  Google's own consent screen; we keep only a revocable refresh token, with the narrowest
  scope (`calendar.readonly`).
- **The server fetches; the browser reads.** Calendar feeds and any external call happen
  server-side, are cached, and degrade gracefully: if Google is unreachable, keep showing
  the last good data and mark it stale.
- **Config errors fail loudly at startup;** a bad edit while running keeps serving the last
  good config and logs the problem. Unknown keys are errors (strict zod).
- **Palette and tokens live as CSS variables** (`@theme` in `src/index.css`). Never hardcode
  hex in components. Dark is the default; it's a wall display, so legibility from across a
  room beats cleverness (large type, high contrast).
- **Beginner-readable, industry-standard layout.** Thin routes, logic in services, small
  files with one job, hooks for data and components for drawing; `docs/ARCHITECTURE.md` is
  kept current so a newcomer can follow the flow.
- **Comments:** middle ground. Explain *why* and non-obvious behaviour. Don't narrate
  obvious code.
- **Every slice must leave the app working and deployable.** Commit per slice, on a branch
  per slice, merged when it runs.
- **Test by running it.** After each slice: start the server, curl the endpoints, load the
  page, and report what you actually verified versus what you couldn't.
- **Log lines never contain calendar URLs, tokens, or event titles at info level.** Event
  titles are personal data. Request logging is off by default because URLs may carry tokens.

---

## 3. The environment (facts Claude Code needs)

| Thing | Value |
|---|---|
| Developer | James, software development student (NAIT), Sherwood Park, AB |
| Dev machine | Windows PC. **Docker Desktop has failed to start there**, so don't depend on building images locally. Multi-arch builds run in GitHub Actions; test images on a Pi or the NAS. |
| Target hardware (James) | Raspberry Pi 5 driving a portrait screen in the kitchen, **HDMI to an old TV** (running DAKboard today). TVs overscan and may default to 720p/1080i; see slice 6. |
| Second site | His parents' kitchen: another portrait screen, **a thin client of James's server** (they are not tech savvy; James handles setup remotely). Hardware and network access still to be confirmed. |
| Homelab (optional host) | Synology NAS at 192.168.1.248 (Docker via Container Manager, ~10 GB RAM). Cloudflare tunnel + Cloudflare Access on `weezle.me`. The homelab dashboard is a separate repo. |
| Calendar source | Google Calendar. Several Google accounts, including the parents'. |
| Photos | Uploaded per screen through the admin UI, stored under `/data/photos/<screen>`. A hand-mounted folder also works. |

---

## 4. Key design decisions (read before building)

### 4.1 Calendar access: Google OAuth is the main path **[rev2]**

James's answer: "as close to real-time as possible". Secret iCal feeds lag by minutes to
hours, so they cannot be the main path.

| | Secret iCal URL | OAuth + Calendar API |
|---|---|---|
| Freshness | Slow, unpredictable | Near real time (poll ~1 min with sync tokens) |
| Setup for a user | Copy a URL | Google Cloud project once per install, then a consent click per account |
| Calendars you don't own | Often unavailable | Works if shared with the account |
| Token risk | URL is a bearer secret | Refresh token on disk, revocable |

**Decision:**
- Calendar layer is an interface (`getEvents(range)`). **Google OAuth provider is built
  first (slice 2).** iCal provider stays as a small secondary provider (works with no Google
  Cloud setup, useful for non-Google feeds).
- "Near real time" = polling `events.list` every 60 s. (Built without `syncToken`: Google does not allow a sync token together with the `timeMin`/`timeMax` window we need, and a few calendars every minute is well inside quota.)
  Google push channels need a public HTTPS webhook and renewal; not worth it for a home
  install. Revisit only if 60 s feels slow.
- **Testing-mode trap:** an OAuth app in "Testing" has refresh tokens that **expire after 7
  days**. The Google Cloud project must be switched to "In production". For a personal-use
  app with `calendar.readonly` this works without verification (users see an "unverified
  app" screen once, 100 user cap). Document this prominently in the README. Each self-hoster
  creates their own Cloud project; we ship no shared client ID.
- **Passwords:** James's note says the parents "will supply username/passwords". We can't
  and won't use passwords (Google blocks password access to the Calendar API, and storing
  them would be a liability). Instead: the admin UI has a "Connect Google account" button;
  the parents (or James on a call with them, or on their machine) signs in on Google's page
  and approves read-only access once. No passwords touch our server. See Q3 in section 9.

### 4.2 One install, many screens

Screens are defined in config, not accounts:

```yaml
screens:
  kitchen:
    title: Kitchen
    layout: portrait-agenda
    timezone: America/Edmonton
    calendars: [james-personal, james-work]
    photos: { folder: kitchen, interval: 60 }
  parents:
    title: Parents
    layout: portrait-agenda
    calendars: [parents-family]
    photos: { folder: parents }
```

Served at `/<screen-id>` (and `/` goes to the configured default). A browser homepage is
just another screen (or the same one) opened in a normal browser. **[rev2]** From slice 4 the
admin UI edits the same data (screen → calendars, layout, photo); `config.yaml` holds the
boot-time bits (Google client, default screen, optional seed screens) and the UI-managed
settings live in `/data/settings.json`. Config seeds, the UI overrides.

**Exposure decision (made [rev2]): option 2, one server, parents' Pi as a thin client.**
The server holds the parents' calendar tokens, so it must not be open to the internet:
1. ~~Run a copy at the parents' house.~~ Rejected: not tech savvy.
2. **One server, screens as thin clients behind Cloudflare Access** (service token or IP
   allow for the Pi) **plus** a per-screen secret token as a second layer. **Chosen.**
3. Per-screen secret token in the URL (`/parents?k=...`), checked server-side. Light
   fallback only; never the sole protection for calendars.
The admin UI (which can connect accounts and upload files) must sit behind Cloudflare Access
or its own password, **never public**. See Q9.

### 4.3 Photos **[rev2]**

Uploaded per screen through the admin UI into `/data/photos/<screen>`, or dropped in as a
mounted folder. Predictable, private, no API keys. Remote sources are out of scope (Google
Photos has no reliable public read API for shared albums). Large originals are a Pi memory
risk (and phone photos are 4000+ px): slice 1 decides between "serve as-is, document
recommended sizes" and a cached resize step (`sharp`, a native dependency, only if needed).
Once uploads exist (slice 4) a resize/limit **on upload** is the likely answer, so the Pi
never decodes a 12 MP image.

### 4.4 Layout and orientation

Portrait is the primary layout; physical rotation is an OS/browser concern (document it),
but the CSS must be designed portrait-first and adapt to landscape for the browser
homepage. Layouts are named presets selected per screen (config, then admin UI).

### 4.5 Hardware tiers (cheapest options)

| Tier | What | Notes |
|---|---|---|
| Thin client | Any device with a browser opening the screen URL: old tablet, Pi Zero 2 W / Pi 3 in kiosk mode, smart TV browser | Cheapest. Container runs elsewhere (NAS, mini PC, VPS). **The parents' screen is this tier.** |
| All-in-one | Pi 4 or Pi 5 running Docker plus Chromium kiosk against `localhost` | What James has. Needs the arm64 image |

Don't promise the container on a 512 MB Pi Zero. Recommend it as a kiosk client only.

---

## 5. Repo layout (target)

```
Home-Display/
  config/config.example.yaml     boot config (real config.yaml gitignored)
  server/src/index.js            entry: load settings + config, start Fastify
  server/src/settings.js         environment variables
  server/src/config.js           YAML load + env interpolation + strict zod validation
  server/src/app.js              creates the Fastify app, registers routes
  server/src/routes/             thin HTTP handlers, one file per topic (health, screens, photos, web, later calendar/admin)
  server/src/services/           the logic routes call (photos; later calendar providers, recurrence, store)
  server/src/calendar/           provider interface, google + ical providers, merge  [slice 2]
  server/src/store.js            /data file store: tokens, settings (atomic writes)   [rev2]
  server/test/                   node:test files, named after what they cover
  web/src/App.jsx                picks the screen from the URL
  web/src/components/            visible pieces: Clock, Slideshow, later Agenda, admin pages
  web/src/hooks/                 data and timers: useScreen, usePhotoList, useNow
  web/src/index.css              Tailwind + palette tokens
  docs/ARCHITECTURE.md           beginner tour of the code
  docs/pi-kiosk.md               Pi setup, rotation, autostart, watchdog
  Dockerfile  docker-compose.yml  .env.example  .dockerignore  .gitignore
  .github/workflows/             lint, test, multi-arch image build + publish
  README.md  ROADMAP.md  CLAUDE.md  LICENSE
```

---

## 6. Roadmap

Each slice has a goal, tasks, and **acceptance criteria**. Do them in order.
**[rev2]** The order changed: Google OAuth is slice 2, protection lands with multi-screen in
slice 3, and the admin UI is a new slice 4 (previously "layouts"). Old slices 4-7 shift to
5-8.

**Honest scope note:** the minimum product that replaces DAKboard is now slices 0-4, not 0-3,
because James wants UI-managed screens and the parents' screen needs real protection. Slice
2 (OAuth + recurrence) and slice 4 (admin UI + auth) are the two big ones. If November's
hackathon squeezes time, ship slices 0-3 with config-file screens first, and add the UI
after.

### Slice 0: Repo, CI, skeleton
**Goal:** An empty but deployable app, with the project plumbing in place.
- Scaffold server/web as above, lint in both, `/api/health`, strict zod config loader with
  `config.example.yaml`, startup validation that fails loudly.
- Dockerfile (multi-stage), `docker-compose.yml` (with a `/data` volume), `.env.example`,
  `.gitignore` (real config, `.env`, `/data`, photos), LICENSE (MIT).
- GitHub Actions: lint on push; **build multi-arch image on tag** (buildx, `amd64` + `arm64`)
  and publish to GHCR.
- Startup summary log line (config valid, calendars count, screens, photos folder readable).

**Accept:** `npm run lint` passes; server starts and `/api/health` answers; a bad config
fails with a readable message; the workflow file is present and lints (it can't be fully
verified until pushed).

### Slice 1: Screen shell: clock and photo background
**Goal:** A portrait page that looks like a wall display, with no calendar yet.
- `/` and `/:screenId` routes; screen config (title, timezone, layout, photos).
- Large clock and date, 12/24 hour option, correct timezone (configured, not the browser's).
- Photo background slideshow with crossfade; `GET /api/screens/:id/photos` lists files;
  `GET /photos/:screen/:file` serves them, path-traversal safe. Empty folder falls back to a
  tasteful solid/gradient background.
- Respect `prefers-reduced-motion`; overlay keeps text legible over any photo.
- Decide and document the large-image strategy (serve as-is vs cached resize).

**Accept:** page renders in portrait and landscape; photos rotate on the interval; a missing
or empty folder doesn't break the page; a request like `/photos/kitchen/..%2f..%2fconfig.yaml`
is refused.

### Slice 2: Calendar agenda, Google OAuth first **[rev2]**
**Goal:** Real, near-live events on the screen.
- Provider interface (`getEvents(range)`), per-calendar cache, last-good retained on failure.
- **Google provider:** OAuth authorization-code flow (server-side, `access_type=offline`,
  `calendar.readonly`), refresh tokens in `/data/tokens.json` (file mode 600, atomic writes),
  `events.list` polling about every 60 s (no `syncToken`, see 4.1), `singleEvents=true` so Google
  expands recurrence for us. Handle `invalid_grant` (revoked/expired token) by marking the
  account "needs reconnect" on the screen and in logs, never crashing.
- **Built:** until the admin UI exists (slice 4) the connect routes are off unless `GOOGLE_CONNECT_ENABLED=true`, because there is no login yet. Open
  `/api/auth/google/start?account=<name>`, approve, done. Accounts are named in config.
- **iCal provider (deferred, needs James's OK on the dependency):** a secondary provider with a parser (propose `node-ical` or `ical.js`
  + `rrule` and why). Recurrence (RRULE, EXDATE, RECURRENCE-ID, all-day, DST) is the hard
  part here, so cover with tests using saved fixtures. The Google path avoids this.
- Multiple calendars per screen, merged, sorted, colour and label per calendar.
- `GET /api/screens/:id/events?days=N` returns merged events; the browser never sees URLs
  or tokens.
- Agenda UI: Today and the next N days, "now" marker, all-day events at the top, large type,
  visible "last updated / stale" hint.

**Accept:** two calendars from two different Google accounts appear merged with distinct
colours; an edit made in Google appears on the screen within about 2 minutes; a modified
recurring instance shows the modified one only; killing the network keeps showing cached
events with a visible "stale" hint; revoking the app's access shows "reconnect needed", not a
crash; no token, calendar URL or event title in default logs or in any response other than
`/events`.

### Slice 3: Multiple screens and protection **[rev2] (BUILT, see notes below)**

**Built:** per-display access tokens (`?k=`, made in the dashboard); a display with no token is served only to the home network and refused when the request arrives through a tunnel or from a public address (Cloudflare reports the visitor address); "paste the address" Google sign-in for installs without a domain or https; compose recipes (home only, tunnel profile). Not verified: a real Cloudflare tunnel, and the parents' own Google sign-in.
**Goal:** `kitchen` and `parents` from one install, safe to reach from outside the LAN.
- `screens:` map in config, each with its own calendars, photos folder, timezone, title and
  layout; unknown screen id gives a clear 404 page. `/` redirects to `defaultScreen`.
- Per-screen `token` checked server-side on the data endpoints (constant-time compare;
  token never logged). Documented as a second layer, **not** real auth.
- Document and verify the Cloudflare Access setup for the parents' Pi (service token header
  from the Pi's browser, or IP/Access policy).
- Calendar tokens never cross screens: a screen can only read calendars it lists.

**Accept:** two screens in one config show different calendars and photos; one screen's
events never appear on the other; a wrong or missing token returns 401 when a token is set;
the parents' Pi can load its screen through the tunnel and an anonymous request cannot.

### Slice 4: Admin UI **[rev2, new] (BUILT, see notes below)**
**Goal:** James can manage everything from a browser instead of editing YAML.

**Built as asked (admin password chosen):** `/admin` is a separate page from the display. Single shared `ADMIN_PASSWORD` from `.env`, HttpOnly SameSite=Strict session cookie, lockout after 5 wrong tries, same-origin check on writes. It edits per screen: layout, weeks, week start, 12/24h, text size (0.7x to 1.6x), photo interval, which calendars show, and photos (resized to 1920px in the browser before upload, so no `sharp` dependency). It can add calendars from a connected Google account (shared ones too) and connect or reconnect accounts. Changes are saved to `/data/settings.json` and applied live. **Rotation option (added):** a per-screen `rotate` (0/90/180/270) turns the picture itself, so a TV or stick that cannot rotate its own output can still show the portrait layout. The display sizes in container units (`cqw`/`cqh`), not `vw`/`vh`, so use those in new display components. **Displays (added):** the dashboard has a display selector and *Add a display*; each display has its own title, timezone, layout, text size, rotation, calendars and photos. The wall display is served at `/display/<id>` (bare `/display` = default; old `/<id>` links redirect). The display page is view-only and public by design, so Slice 3 must put a per-display token and Cloudflare Access in front of it before it leaves the LAN. Still to do in this slice: edit timezone/title/photo folder, create/delete screens, drag-to-reorder, and a preview pane.
- **Admin auth first.** Decision needed (Q9). Recommended: rely on Cloudflare Access for the
  `/admin` path **and** a single admin password from `.env` (hashed compare, rate limited)
  for installs without a tunnel. No user accounts.
- Pages: Accounts (connect/disconnect Google, status), Calendars (pick which of an
  account's calendars to use, colour, label), Screens (assign calendars, layout, timezone,
  12/24h, photo interval), Photos (upload/delete per screen).
- Uploads: size and type limits (JPEG/PNG/WebP), server-side resize to a sane max (this is
  where `sharp` is justified; ask first), stored under `/data/photos/<screen>`.
- Settings persist to `/data/settings.json` (atomic writes, validated with the same strict
  zod schemas); the display picks up changes without a restart.
- Large, ugly-but-functional is fine. Do not build a design system.

**Accept:** from a phone, connect an account, assign two calendars to a screen, upload a
photo, change the layout, and see the wall screen update on its own; unauthenticated requests
to any admin route or upload endpoint are refused; an oversize or non-image upload is
rejected; deleting `/data/settings.json` falls back to the YAML seed.

### Slice 5: Layouts, week view, browser-homepage mode (BUILT)

**Built:** `month-grid`, `portrait-week` (seven rows), `landscape-split` (clock and 3-day list beside the grid) and `portrait-agenda`, chosen per display in the dashboard; optional search box (Google or DuckDuckGo, off by default); open display pages reload themselves when `/api/health` lists different web files than the ones they loaded (each page checks once a minute), and keep showing the last data while the server restarts. Layouts live in `web/src/layouts/`. Not verified at true 1080x1920 / 1920x1080 on a TV; checked at 540x960 and 960x540 (same ratios).
**Goal:** More than one look, and a good desktop experience.
- Layout presets selectable per screen: `portrait-agenda`, `portrait-week`, `landscape-split`.
- Week view (7-day grid) with the same events and colours.
- Browser-homepage friendly: sensible at desktop sizes, no kiosk assumptions.
- Auto-refresh of data without reloading the page; periodic version check so a redeploy
  reloads the page by itself.
- No new tiles (weather, to-do, etc.): James said no extras for now.

**Accept:** each layout renders correctly at 1080x1920 and 1920x1080; switching a screen's
layout is a settings change only; the page recovers by itself after the server restarts.

### Link buttons and dashboard redesign (BUILT, between slices 5 and 6)

**Link buttons:** up to six per display, round icon buttons, built-in icon set or an uploaded picture (stored in `/data/icons/<display>/`, squared to 128 px in the browser), placed in a row above/below or a column left/right of the calendar. Per display; duplicate addresses on one display are refused; http(s) only. The dashboard was reorganised into tabs with a live preview (an iframe of the real display page).

### Kiosk vs interactive (BUILT)

Per display `mode`: `kiosk` (default; the server sends no links and no search bar, nothing is clickable) or `interactive` (link buttons, searchbar, click a date for the full day in a dialog that covers the stage and works rotated). Saved links and search choices are kept while in kiosk mode. The dashboard shows them off and greyed out in kiosk mode.

### Slice 6: Packaging for sharing (BUILT, image not yet published)

**Built:** README rewritten for strangers (quick start, how to run it, dashboard guide,
troubleshooting); `docs/google-setup.md` (every Google Cloud step, including the Branding
and "publish to production" traps); `docs/configuration.md`; `docs/RELEASING.md`;
`CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`; compose file using a named data volume
(avoids the root-owned bind-mount permission trap) with an optional tunnel profile; CI that
also builds the image, and a release workflow that verifies before publishing.

**Verified without Docker:** the production dependency install and run layout (what the
Dockerfile does) starts from the example config. **Not verified:** a real `docker build`,
the multi-arch publish, and following the README on a clean machine; Docker could not run
on the dev machine. No screenshot yet (one would show real calendar titles).

**iCal provider: removed, not built.** The stub (config shape, "unsupported" status) was
dead code, so it was deleted. Re-add it when someone needs a non-Google feed.

**Goal:** A stranger can run it from the README in ten minutes.
- Published GHCR image (multi-arch), `docker-compose.yml` that pulls it, `config.example.yaml`
  with comments, `.env.example`.
- README: what it is, a screenshot, quick start, **a step-by-step Google Cloud OAuth setup**
  (create project, consent screen, publish to production to avoid 7-day tokens, create client
  ID, redirect URI), the optional iCal path with its lag caveat, config reference, photos,
  updating, reverse proxy / tunnel, security notes.
- Release process (tag, changelog). Public repo hygiene: no secrets in history, LICENSE,
  CONTRIBUTING-lite.

**Accept:** on a clean machine (or the NAS), `docker compose up -d` plus the README's steps
produces a working screen; the README steps are verified by actually following them.

### Slice 7: Raspberry Pi kiosk kit
**Goal:** Plug in, power on, wall display.
- `docs/pi-kiosk.md` (and optional scripts): Raspberry Pi OS, Chromium kiosk autostart,
  disable screen blanking, **portrait rotation**, hide the cursor, container at boot with
  `restart: unless-stopped`.
- **TV specifics (HDMI to an old TV):** force the HDMI mode (1080p), disable overscan or
  compensate with a CSS safe-area setting, disable CEC surprises, and note that TVs may
  sleep: document keeping it awake or letting it sleep on a schedule.
- Recovery: a browser watchdog (reload if the page's health ping stops), behaviour after a
  power cut, optional nightly reboot.
- Night dimming: schedule-based CSS dim (HDMI backlight control isn't generally available).
- Document the thin-client path for cheaper hardware, and the parents' setup.

**Accept:** James's Pi 5 boots straight into the display; pulling the power and restoring it
returns to the display unattended; the same steps are written down well enough that
someone else could follow them. Cheaper-hardware notes are marked "untested" unless tested.

### Slice 8: Polish and hardening
- Empty, error and loading states for every panel; a "last updated" hint; offline behaviour.
- Contrast and legibility pass at distance (large type scale in config).
- Config reload without restart; startup summary improved.
- Basic tests for config, recurrence and path safety wired into CI.

**Accept:** unplugging the network for an hour and restoring it needs no manual action.

### Later (not scheduled)
- Weather (Open-Meteo, no key), countdowns/birthdays tile, chore or notes tile (James: not
  now).
- Other iCal sources (Outlook, Apple) already work through the iCal provider as plain URLs.
- Touch interaction, remote photo sources, Google push notifications instead of polling.

---

## 7. Gotchas to remember

- **OAuth "Testing" status expires refresh tokens in 7 days.** Publish the Cloud project to
  production. This is the number one reason a self-hosted calendar screen silently dies.
- **Google's iCal feeds lag and are not guaranteed fresh.** Say so in the README, and show
  "last updated" on the screen.
- **Refresh tokens and secret iCal addresses are bearer secrets.** Never log them, never send
  them to the browser, never commit them. `/data` and config.yaml are password-file-grade.
- **Back up `/data`.** It's the only state. Losing it means re-connecting accounts.
- **Timezones and DST** are the classic source of off-by-one-hour bugs. Always use the screen's
  configured timezone for "today", not the server's or the browser's.
- **All-day events** are dates, not instants; an all-day event ending "tomorrow" in iCal
  (and in the Calendar API) actually ends today (end date is exclusive).
- **Pi 5 is arm64:** the image must be built for it; an amd64-only image fails with an
  `exec format error`.
- **Chromium memory on small Pis** is the real limit, not Node. Keep the page light:
  preloaded photos only one ahead, no heavy animations, resize uploads.
- **TV overscan** crops the edges of a Pi's HDMI output; keep a configurable safe margin.
- **Screen burn-in/dimming:** an always-on screen should dim at night; keep static UI moving
  slightly or fading if the panel is OLED.
- **Photos folder permissions:** the container must be able to read the mount (and write to
  `/data` as the non-root `node` user, uid 1000).
- **Don't expose a screen or the admin UI publicly without protection.** They show or can
  change calendar contents.

---

## 8. Definition of done (slices 0-7)

- A portrait screen shows clock, photo background and a merged multi-account agenda, legible
  from across a kitchen, updating within about two minutes of a Google edit.
- One install serves at least two screens with separate calendars and photos, managed from an
  admin UI that is not publicly reachable.
- Runs from the published image with one compose file on amd64 and arm64.
- James's Pi 5 boots into it unattended and survives a power cut; the parents' screen works
  as a thin client; a browser homepage works.
- README lets a stranger set it up; secrets stay out of the repo, logs and browser.

---

## 9. Questions for James: answers and what they changed

| # | Question | Needed by |
|---|---|---|
| 1 | Is Google's iCal feed lag acceptable, or do you need near-real-time (pulls OAuth forward)? | Slice 2 |

ANSWER: As close to real-time as possible
**Consequence [rev2]:** OAuth + Calendar API becomes the primary provider (slice 2); iCal is
secondary. Polling with sync tokens, about 60 s.

| 2 | Parents' kitchen: their own container at their house, or your server with their Pi as a thin client? | Slice 3 |
|---|---|---|

ANSWER: They are not tech savvy so my server
**Consequence [rev2]:** thin-client model (section 4.2 option 2). The server holds their
tokens, so slice 3 adds per-screen token + Cloudflare Access, and the admin UI must be
private.

| 3 | Do the parents' calendars live in accounts you control, or will they supply their own secret iCal URLs? | Slice 3 |
|---|---|---|

ANSWER: they will supply their own username/passwords
**Consequence [rev2]:** **we cannot use passwords.** Google's Calendar API does not accept
them, and holding them would be a serious liability for a public project. Plan: Google sign-in
consent (OAuth), done once, with the parents or by James on a call. They never type a
password into our app; we hold a revocable read-only token. **Please confirm this is
acceptable (see Q10).**

| 4 | Photos: where do they come from today (a folder, Google Photos, DAKboard's library)? Roughly how many and what size? | Slice 1 |
|---|---|---|

ANSWER: would be nice to have a UI to organize calendars and layout - can upload an image for each screen via that UI
**Consequence [rev2]:** new admin UI slice (4) with uploads; the app now keeps state in
`/data` (ground rules updated). Slices 1-3 use a plain folder so nothing blocks on the UI.
Still open: how many photos and what sizes (drives the resize decision), see Q11.

| 5 | Repo name, licence (MIT?) and whether the repo is public from day one | Slice 0 |
|---|---|---|

ANSWER: plan for public repo
**Consequence [rev2]:** MIT licence assumed (change if you disagree), no secrets or personal
data ever committed (parents' names, `weezle.me` internals and the NAS IP stay out of the
public docs and example config), README written for strangers. Repo name still the working
name `Home-Display`.

| 6 | What else is on the DAKboard screen today that you'd miss (weather, a to-do list)? | Slice 4 |
|---|---|---|

ANSWER: at this point we dont need to add extra features
**Consequence:** nothing added. Weather and tiles stay under "Later".

| 7 | When does the DAKboard subscription renew (deadline pressure)? | Planning |
|---|---|---|

ANSWER: No deadline pressure
**Consequence:** build in order, hackathon and coursework come first.

| 8 | Is the Pi display 1080p portrait, and is it connected over HDMI to a monitor or a dedicated panel? | Slice 6 |
|---|---|---|

ANSWER: currently via hdmi to an old TV
**Consequence [rev2]:** TV overscan, forced HDMI mode and sleep behaviour added to the kiosk
slice (7). Exact TV resolution still unknown, see Q12.

### New open questions (raised by the answers)

| # | Question | Needed by |
|---|---|---|
| 9 | Admin UI protection: Cloudflare Access only, or also a single admin password from `.env`? **Recommend both**: Access in front for your tunnel, password so a shared copy is safe without one. | Slice 4 |
| 10 | Are you OK with the parents approving a one-time Google "allow read-only calendar access" screen (no password shared with the app)? Would you do it on a call, or on their computer? | Slice 2 |
| 11 | How many photos per screen, and are they phone-sized originals (4000+ px)? Decides resize-on-upload. | Slice 1 |
| 12 | What's the TV's native resolution and does it have overscan controls? | Slice 7 |
| 13 | Are you willing to create a Google Cloud project (free, about 10 minutes) for the OAuth client? It's the one-time prerequisite for real-time calendars. | Slice 2 |

---

## 10. How Claude Code should work with James

- James is a software development student (NAIT), comfortable with JS/React, learning
  backend and DevOps. Explain *why* briefly when making architectural choices.
- Tone: casual and direct. Lead with the answer. When offering options, **recommend one with
  reasoning.**
- Be honest about scope. James has a hackathon in mid-November and coursework. If a slice is
  ballooning, say so and propose a smaller cut. The minimum useful product that replaces
  DAKboard is slices 0-4 (**[rev2]**; slices 0-3 with config-file screens is the fallback).
- Ask before adding auth systems, databases, anything that stores state beyond `/data`, or a
  big dependency. (The admin password in slice 4 and `sharp` are pre-flagged: confirm at the
  time.)
- Never ask James to paste secrets (calendar URLs, tokens, keys, passwords) into chat; use the
  `.env`/config files and read lengths or presence only.
- At the end of each slice, report: what was built, what was verified (and how), what wasn't,
  and the one next step.
