# Configuration reference

Home-Display has three places where things are set. Knowing which is which makes it easy to
back up and to debug.

| Place | What it holds | Edited by |
|---|---|---|
| `config/config.yaml` | Your starting point: the default display and the first calendars. Read-only to the app. | You, in a text editor |
| `.env` | Passwords and secrets, and a few switches (below). | You, in a text editor |
| The data volume (`/data`) | Everything the dashboard changes: settings, Google sign-ins, photos, icons. | The dashboard |

When `config.yaml` and the dashboard disagree, the dashboard wins for the display it changed:
`data/settings.json` is laid on top of `config.yaml`.

## `config/config.yaml`

Unknown keys are errors, so a typo is reported when the app starts.

```yaml
defaultScreen: kitchen          # the display opened at / and /display

calendars:
  james-personal:               # an id you choose
    account: james              # a name for a Google account (connected in the dashboard)
    calendarId: primary         # "primary" or a calendar's id
    label: James
    color: "#4f9dff"

screens:
  kitchen:                      # the display id: /display/kitchen
    title: Kitchen
    timezone: America/Edmonton
    calendars: [james-personal]
```

### Display options

All optional except `title` and `timezone`. Every one of them can also be changed in the
dashboard.

| Key | Values | Default |
|---|---|---|
| `title` | text | required |
| `timezone` | an IANA name, such as `America/Toronto` | required |
| `calendars` | list of calendar ids from `calendars:` | `[]` |
| `layout` | `month-grid`, `portrait-week`, `landscape-split`, `portrait-agenda` | `month-grid` |
| `mode` | `kiosk`, `interactive` | `kiosk` |
| `weeks` | 1 to 6 (grid layouts) | `4` |
| `weekStart` | `sunday`, `monday` | `sunday` |
| `clock` | `"12"`, `"24"` | `"12"` |
| `fontScale` | 0.7 to 1.6 | `1` |
| `rotate` | `0`, `90`, `180`, `270` (degrees clockwise) | `0` |
| `search` | `true`, `false` (interactive mode only) | `false` |
| `searchPosition` | `above`, `below` | `below` |
| `links` | up to six `{title, url, icon}`; icon is `preset:<name>` | `[]` |
| `linksPosition` | `top`, `bottom`, `left`, `right` | `bottom` |
| `photos.interval` | seconds per photo, 5 to 3600 | `60` |
| `photos.folder` | folder name under the photos directory | the display id |
| `token` | an access token, 16+ characters | none |

The names `admin`, `display`, `api`, `photos`, `icons` and `assets` cannot be display ids.

A value like `${NAME}` inside `config.yaml` is replaced with the environment variable `NAME`,
which keeps secrets (such as a fixed `token`) out of the file.

## Environment variables (`.env`)

| Variable | Needed | Meaning |
|---|---|---|
| `ADMIN_PASSWORD` | to use the dashboard | Without it the dashboard is switched off |
| `GOOGLE_CLIENT_ID` | to read Google calendars | From your Google Cloud client |
| `GOOGLE_CLIENT_SECRET` | to read Google calendars | From your Google Cloud client |
| `PUBLIC_BASE_URL` | if not `http://localhost:8080` | The address people use; must match a redirect URI in Google |
| `CLOUDFLARE_TUNNEL_TOKEN` | for the `tunnel` profile | From Cloudflare Zero Trust |
| `PORT`, `HOST` | no | Listening port (8080) and address (0.0.0.0) |
| `LOG_LEVEL` | no | `info` (default), `warn`, `debug`... Calendar titles are never logged at `info` |
| `CONFIG_PATH`, `DATA_DIR`, `PHOTOS_DIR`, `ICONS_DIR`, `WEB_DIST` | no | Where things live; the container sets sensible values |

## What is stored in the data volume

| File | Contents | Sensitive? |
|---|---|---|
| `settings.json` | What you changed in the dashboard, including display access tokens | Yes (owner-only permissions) |
| `tokens.json` | Google refresh tokens | **Yes**: treat like a password file |
| `photos/<display id>/` | Background photos | Personal |
| `icons/<display id>/` | Uploaded link-button pictures | No |

Back the volume up. To start fresh, stop the container and delete the volume (this signs out
all Google accounts).

## Security notes

- The dashboard is protected by one shared password, a session cookie, a lockout after five
  wrong tries, and a same-site check on every change.
- Display pages are view-only and need no login. At home they are open; from outside they need
  the display's access token. Treat an address with `?k=...` like a password and use **Make a
  new token** if it leaks.
- Google tokens and display tokens are never sent to a browser except to a logged-in
  dashboard, and are never written to logs.
- Run it behind HTTPS (a tunnel or reverse proxy) if you use it outside your home, and set
  `PUBLIC_BASE_URL` to the https address so cookies are marked secure.
