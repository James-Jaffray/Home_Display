# Running on a Synology NAS (Container Manager)

This builds and runs Home-Display on the NAS itself, so it works before any image has been
published, and it is the same for a future published image apart from step 4.

You need DSM 7.2 or newer with **Container Manager** installed (Package Center), and a Google
OAuth client ([google-setup.md](google-setup.md)).

## 1. Put the code on the NAS

Pick one.

**A. Download the ZIP (no command line).**

1. On GitHub, open the repository, press **Code → Download ZIP**.
2. In **File Station**, open the shared folder `docker` (create it in Control Panel → Shared
   Folder if it does not exist) and upload the ZIP there.
3. Right-click the ZIP → **Extract Here**, then rename the extracted folder to
   `home-display`. You should now have `/docker/home-display/Dockerfile` next to
   `docker-compose.yml`.

**B. Git over SSH.** Turn on **SSH** (Control Panel → Terminal & SNMP), then:

```bash
ssh your-admin-name@<nas-ip>
cd /volume1/docker
git clone https://github.com/James-Jaffray/Home_Display.git home-display
```

(`git` comes with the **Git Server** package.)

## 2. Create the two settings files

Inside `/docker/home-display`, create:

**`.env`** (copy `.env.example` and fill in):

```
ADMIN_PASSWORD=choose-a-long-password
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

**`config/config.yaml`** (copy `config/config.example.yaml` and set your timezone):

```yaml
defaultScreen: kitchen

calendars:
  james-personal:
    account: james
    calendarId: primary
    label: James
    color: "#4f9dff"

screens:
  kitchen:
    title: Kitchen
    timezone: America/Edmonton
    calendars: [james-personal]
```

Easiest is to write both files on your PC and upload them to the folder with File Station.
Names starting with a dot (`.env`) are fine: upload as `.env`, or upload as `env.txt` and
rename in File Station.

## 3. Create the project

1. Open **Container Manager → Project → Create**.
2. **Project name:** `home-display`. **Path:** choose `/docker/home-display`.
3. **Source:** choose **Create docker-compose.yml** and paste the contents of
   `docker-compose.build.yml` from the repository (it builds from this folder).
4. Skip the web station / portal options and finish. Container Manager builds the image
   (a few minutes the first time: it downloads Node and builds the app) and starts it.

> Prefer the command line? `cd /volume1/docker/home-display` then
> `sudo docker compose -f docker-compose.build.yml up -d --build`.

## 4. Open it

- Dashboard: `http://<nas-ip>:8080/admin` (log in with `ADMIN_PASSWORD`).
- Display: `http://<nas-ip>:8080/display/kitchen`.

If port 8080 is taken on the NAS (the build ends with "port is already allocated"), add
`HOST_PORT=8081` on its own line in `.env`, run the same command again, and use 8081 in the
addresses. The app keeps using 8080 inside the container, so the Google redirect URI does not
change.

## 5. Connect Google

Because the dashboard is at an `http://` address that is not `localhost`, Google will not
send you straight back. Use the paste step:

1. **Accounts** tab → **Connect**, sign in with Google and press **Allow**.
2. The final page will not load (an error page on `localhost:8080`). That is expected. Copy
   its **whole address** from the address bar.
3. Back in the dashboard (Accounts tab), open **Signed in on Google but the page did not
   load?**, paste it and press **Finish sign-in**.
4. **Calendars** tab: switch on the calendars to show.

## 6. Point the Raspberry Pi at it

Open `http://<nas-ip>:8080/display/kitchen` in the Pi's full-screen browser. It is view-only
and needs no login on your home network.

## Updating

- ZIP: download the new ZIP, replace the folder's contents (keep your `.env` and
  `config/config.yaml`), then in Container Manager → Project → `home-display` → **Action →
  Build** (or Stop, then Start).
- Git: `git pull` in the folder, then **Action → Build**.

Your settings and Google sign-ins are in the `home-display-data` volume and are kept.

## If it does not start

Container Manager → Container → `home-display-home-display-1` → **Log**.

| Log says | Fix |
|---|---|
| `Invalid configuration` | The message names the setting in `config/config.yaml`. |
| `cannot read /config/config.yaml` | The file is missing, or the project **Path** is wrong. |
| "port is already allocated" | Another app uses 8080; set `HOST_PORT=8081` in `.env` as in step 4. |
| Build fails while downloading | The NAS needs internet access to build. |
