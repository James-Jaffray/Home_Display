# Connect Google Calendar

Home-Display reads your calendars with a Google "OAuth client" that **you** create (it is
free, takes about ten minutes, and nothing is shared with anyone else). You do this once per
install.

You will end up with a Client ID and a Client secret to paste into `.env`.

> **The one step people miss:** publish the project ("In production"). A project left in
> "Testing" makes Google expire the sign-in every 7 days, and the screen silently stops
> updating.

## 1. Create a project

1. Go to <https://console.cloud.google.com> and sign in.
2. Open the project picker at the top, choose **New project**, name it `Home-Display`, create it
   and make sure it is selected.

## 2. Turn on the Calendar API

1. **APIs & Services → Library**.
2. Search for **Google Calendar API** and press **Enable**.

## 3. Set up the consent screen ("Google Auth Platform")

1. Open **APIs & Services → OAuth consent screen** (newer consoles call it **Google Auth
   Platform**) and press **Get started**.
2. **App information:** name `Home-Display` and your email as the support email.
3. **Audience:** choose **External**.
4. **Contact information:** your email, then agree and **Create**.

### Branding: homepage and privacy policy

To publish later, Google requires an app **home page**, a **privacy policy link**, and the
domain of each listed under **Authorized domains**. The simplest option:

- Application home page: this project's page, `https://github.com/James-Jaffray/Home_Display`
  (or the same page in your own fork).
- Privacy policy link: the address of [PRIVACY.md](../PRIVACY.md) on GitHub,
  `https://github.com/James-Jaffray/Home_Display/blob/main/PRIVACY.md` (the repository must
  be public).
- Authorized domains: add `github.com` if Google asks for it. If it refuses, use a page on a
  domain you own instead.

Save the Branding page.

## 4. Add the read-only permission

1. **Data Access → Add or remove scopes.**
2. Add `https://www.googleapis.com/auth/calendar.readonly` and save.

This is the only permission Home-Display ever asks for. It cannot change or delete events.

## 5. Publish ("In production")

1. **Audience → Publish app**, and confirm.
2. The status should read **In production**.

Google will show a banner saying the app "requires verification". You can ignore it for
personal use: the app works for up to 100 people, and each person just sees a one-time "Google
hasn't verified this app" page (press **Advanced**, then **Go to Home-Display**, then
**Allow**).

## 6. Create the OAuth client

1. **Clients → Create client**, type **Web application**, name it `Home-Display`.
2. **Authorized redirect URIs:** add exactly the addresses you will use to sign in:

   | You open the dashboard at | Add this redirect URI |
   |---|---|
   | `http://localhost:8080` on the server itself | `http://localhost:8080/api/auth/google/callback` |
   | `https://display.example.com` (a tunnel or domain) | `https://display.example.com/api/auth/google/callback` |

   Plain `http://` is only accepted for `localhost`. For any other home-network address,
   use the paste step described under
   [Signing in to Google without a domain](../README.md#signing-in-to-google-without-a-domain).
3. Press **Create**, then copy the **Client ID** and **Client secret**.

## 7. Put the values in `.env`

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

If you reach the app at an address other than `http://localhost:8080`, also set
`PUBLIC_BASE_URL=https://display.example.com` so the sign-in uses the matching redirect URI.

Restart (`docker compose up -d`), open the dashboard, and use the **Accounts** tab to
**Connect**.

## Adding someone else's calendar

On the **Accounts** tab press **Add another Google account**, give it a short name, and sign in
as that person on Google's page (they can do it on their own device if the dashboard is
reachable there). Their password is never shared. Then switch their calendars on in the
**Calendars** tab.

## Changing your mind

- To stop Home-Display reading an account, press **Disconnect** on the Accounts tab, or remove
  it at <https://myaccount.google.com/permissions>.
- To revoke everything, delete the OAuth client in Google Cloud.
