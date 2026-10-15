# Privacy Policy

_Last updated: 2026-10-14_

**kitchen-display** is a self-hosted, open-source wall display. It shows a clock, a photo
background and a Google Calendar agenda. This policy explains what the app does with your
data when you connect a Google account.

## Who runs it

kitchen-display is not a hosted service. Each person who installs it runs their own copy on
their own server. The data described below stays on that server and is controlled by the
person who runs it (the "operator"). The authors of the software do not receive any of it.

## What the app accesses

When you connect a Google account, the app asks for one permission:

- **Read-only access to your Google Calendar**
  (`https://www.googleapis.com/auth/calendar.readonly`).

It uses this to read the events (title, time, location and calendar name) of the calendars
you choose, so it can show them on the display.

The app never creates, edits or deletes calendar events, and it never reads your email,
contacts, files or any other Google data.

## What the app stores

- **A refresh token** for each connected Google account, kept in a file on the operator's
  server. This lets the display keep working without asking you to sign in again.
- **Settings** you or the operator choose, such as which calendars appear on which screen.
- **Photos** the operator uploads for the background.

Your Google password is never seen or stored by the app. Sign-in happens on Google's own
page.

Calendar events are held in memory briefly to be shown on the display. They are not written
to a database or kept as a long-term copy.

## What the app shares

Nothing. Calendar data is sent only from the operator's server to the displays that the
operator has set up. It is not sold, shared with third parties, used for advertising, or
used to train any machine-learning model.

The app does not include analytics or tracking.

## Google API Services

The use and transfer of information received from Google APIs to any other app adheres to
the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.

## Your choices

- **Revoke access at any time** at <https://myaccount.google.com/permissions>. Remove
  kitchen-display from the list and the stored token stops working immediately.
- **Delete the data** by removing the account in the app, or by deleting the operator's
  `/data` folder.
- **Ask the operator** (the person whose display you are connecting to) what they have
  stored. If you are a family member connecting to someone else's display, they are the
  person to ask.

## Security

Tokens and settings are stored on the operator's server and are never sent to the browser
that shows the display. Operators are responsible for keeping their server and access
credentials secure and for not exposing the display or its admin pages publicly without
protection.

## Changes

If this policy changes, the new version will appear in the project repository with an updated
date.

## Contact

Questions or concerns: open an issue on the project's GitHub repository, or contact
james.v.jaffray@gmail.com.
