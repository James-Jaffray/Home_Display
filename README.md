# Home-Display

A self-hosted wall display for your calendar. A big clock, your Google calendars (several
accounts on one screen if you like), a photo background and optional link buttons, made for
a portrait kitchen TV driven by a Raspberry Pi, and just as happy as your browser homepage.

- **One container**, no database, no subscription. Your data stays on your machine.
- **Several displays** from one install (kitchen, hallway, a parent's house), each with its
  own calendars, photos, layout and address.
- **A dashboard** to change everything from your phone, with a live preview.
- **Kiosk or interactive:** a view-only wall screen, or a homepage with link buttons, a
  search bar and click-a-date for the full day.
- **Safe by default:** nothing is exposed to the internet unless you ask, and a display that
  has not been given an access token refuses requests that come from outside your home.

> It reads your calendars through Google's own sign-in and asks only for **read-only**
> access. Your Google password is never seen or stored. See [PRIVACY.md](PRIVACY.md).

## Quick start (about ten minutes)

You need Docker with Docker Compose, and a Google account.

1. **Get the files.** Clone this repository and open a terminal in it:

   ```bash
   git clone https://github.com/James-Jaffray/Home_Display.git
   cd Home_Display
   ```

2. **Create your settings files.**

   ```bash
   cp .env.example .env
   cp config/config.example.yaml config/config.yaml
   ```

3. **Choose a dashboard password.** Put it after `ADMIN_PASSWORD=` in `.env`.

4. **Connect Google Calendar.** Create a free Google Cloud "OAuth client" and put its two
   values in `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). The step-by-step guide,
   with the settings that matter, is in [docs/google-setup.md](docs/google-setup.md).

5. **Edit `config/config.yaml`.** At minimum set your `timezone` (for example
   `America/Toronto`). Everything else can be done in the dashboard.

6. **Start it.**

   ```bash
   docker compose up -d
   ```

7. **Open the dashboard** at `http://localhost:8080/admin` (or `http://<server-ip>:8080/admin`
   from another device), log in, and:
   - **Accounts** tab: press **Connect** and sign in with Google.
   - **Calendars** tab: switch on the calendars you want.
   - Press **Open display**: that address is what your TV or Pi opens.

If something does not work, see [Troubleshooting](#troubleshooting).

## Choose how to run it

| | **A. Home network only** (default) | **B. Also reachable from outside** |
|---|---|---|
| Needs | Nothing extra | A domain on Cloudflare (the free plan is fine) and a tunnel |
| Displays open at | `http://<server-ip>:8080/display/<id>` | `https://display.yourdomain/display/<id>` |
| Access token | Not needed | Required for each display opened from outside |
| Google sign-in | See [Signing in without a domain](#signing-in-to-google-without-a-domain) | Normal |

### A. Home network only

Run `docker compose up -d` and open the addresses above from devices at home. **Do not
port-forward the app on your router.**

### B. Also reachable from outside (optional)

1. In Cloudflare Zero Trust create a tunnel with a public hostname such as
   `display.yourdomain.com` pointing to `http://home-display:8080`.
2. Put the tunnel token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN` and set
   `PUBLIC_BASE_URL=https://display.yourdomain.com`.
3. Start with the tunnel: `docker compose --profile tunnel up -d`.
4. In the dashboard, **Access** tab, switch on **Require an access token** for every display
   you want to open from outside, and use its **From outside** address.
5. Add `https://display.yourdomain.com/api/auth/google/callback` as a redirect URI in your
   Google Cloud client.

How it stays safe: a display without a token is only served to the home network. Requests
that arrive through a tunnel (Cloudflare reports the visitor's address) are refused until the
display has a token. The dashboard always needs `ADMIN_PASSWORD`; add Cloudflare Access in
front of `/admin` for a second lock.

### Signing in to Google without a domain

Google only sends people back to `https://` addresses or `localhost`. If you open the
dashboard at `http://192.168.1.50:8080` and press **Connect**, you end on a page that cannot
load. That is expected: copy that page's address from the address bar, paste it into
**Signed in on Google but the page did not load?** (Accounts tab) and press **Finish
sign-in**. Signing in from the server's own browser at `http://localhost:8080/admin` needs no
pasting.

## Using it

### The dashboard

Pick a display in the header, then use the tabs. The live preview beside them shows each
change as you make it, and changes save automatically.

| Tab | What it does |
|---|---|
| **Look** | Layout, kiosk or interactive, name, timezone, clock, weeks shown, text size, rotation, searchbar |
| **Calendars** | Switch calendars on or off for this display (shared calendars included) |
| **Links** | Up to six round link buttons, with built-in or uploaded icons |
| **Photos** | Background photos and how long each stays |
| **Access** | The display's address, its access token, and deleting it |
| **Accounts** | Connect Google accounts (yours, a partner's), disconnect them |

### Kiosk or interactive

| | **Kiosk** (default) | **Interactive** |
|---|---|---|
| For | A wall screen or TV | A browser homepage |
| Link buttons | Off | On |
| Searchbar | Off | On, if you switch it on |
| Click a date | Nothing happens | Opens that day's full list of events |

Switching a display to kiosk does not delete its links or searchbar choice; they come back
when you switch to interactive again.

### Layouts

| Layout | Good for |
|---|---|
| Calendar grid (several weeks) | A portrait wall screen (default) |
| One week, a row per day | A portrait screen where titles must be readable from far away |
| Wide: clock and list beside the grid | A landscape TV or a desktop browser |
| List of events | A small or narrow screen |

### Several displays, several people

Use **Add display** in the header for each screen. Each display has its own calendars,
photos, look, links and address. To put a partner's calendar on the same screen, add their
account on the **Accounts** tab (they sign in on Google's page; you never see their
password), then switch their calendars on for the display.

### Link buttons and the searchbar

Up to six round link buttons per display, placed above or below the calendar or in a column
beside it. They belong to one display; another display starts with none. The searchbar is a
plain Google search box, above or below the calendar. Both only appear in interactive mode.

### Rotating the picture

If your TV or device cannot rotate its own output, turn the TV on its side and use **Rotate the
picture** on the Look tab (90° either way). The page itself is rotated, so no operating system
setting is needed.

### Photos

Upload photos on the **Photos** tab. They are resized to 1920 px in your browser first, so a
Raspberry Pi never has to decode a 12-megapixel original. You can also drop `.jpg`, `.png`,
`.webp` or `.avif` files into the display's folder under `/data/photos/<display id>/`.

## Configuration

`config/config.yaml` only describes your starting point; the dashboard does the rest and saves
to the data volume. The full list of options, environment variables and where things are
stored is in [docs/configuration.md](docs/configuration.md).

## Updating

```bash
docker compose pull
docker compose up -d
```

Open display pages notice the new version and reload themselves within a minute, so a TV that
stays on for months needs no attention. Your settings, tokens and photos live in the
`home-display-data` volume and survive updates. **Back that volume up**: it holds everything
that cannot be recreated (your Google sign-ins, dashboard settings and photos).

## Running on a Synology NAS

Container Manager can build and run it directly from the repository. The steps, click by click,
are in [docs/synology.md](docs/synology.md). The same `docker-compose.build.yml` works on any
machine with Docker when no published image exists yet:
`docker compose -f docker-compose.build.yml up -d --build`.

## Running on a Raspberry Pi

The image is built for `linux/amd64` and `linux/arm64`, so it runs on a Raspberry Pi 4 or 5
with a 64-bit OS, or on a PC, NAS or mini PC. A cheaper setup is to run the container on
something always on and let each TV's Pi simply open the display address in a full-screen
browser. A kiosk setup guide for the Pi (autostart, rotation, power-cut recovery) is planned
under `docs/`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `docker compose up` exits with "Invalid configuration" | The message names the exact setting. Fix `config/config.yaml` and start again. |
| The dashboard says it is turned off | `ADMIN_PASSWORD` is empty in `.env`. |
| Connect says Google is not configured | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing. |
| "redirect_uri_mismatch" from Google | The redirect URI in Google Cloud does not exactly match. See [docs/google-setup.md](docs/google-setup.md). |
| Calendars stop updating after about a week | The Google Cloud project is still in "Testing", where tokens expire after 7 days. Publish it ("In production"). |
| A display says it needs its access token | Open the address from the dashboard's **Access** tab, which includes `?k=...`. |
| A display opens at home but not from outside | Intended. Switch on **Require an access token** for it. |
| A calendar shows "reconnect needed" | Google rejected the saved sign-in. **Accounts** tab, **Reconnect**. |

## Development

```bash
npm install
cp config/config.example.yaml config/config.yaml
cp .env.example .env            # then set ADMIN_PASSWORD
npm run dev:server              # API on http://localhost:8080
npm run dev:web                 # dashboard and display on http://localhost:5173
npm run lint && npm test
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a tour of the code and
[CONTRIBUTING.md](CONTRIBUTING.md) before sending changes. The plan and the reasons behind
decisions are in [ROADMAP.md](ROADMAP.md).

## Licence

MIT. See [LICENSE](LICENSE).
