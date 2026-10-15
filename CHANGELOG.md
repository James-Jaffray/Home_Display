# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]

First release.

### Added
- Wall display at `/display/<id>`: clock, photo slideshow, and four layouts (calendar grid,
  one week, wide split, list).
- Google Calendar through read-only OAuth, several accounts on one screen, calendars polled
  about every minute with the last good data kept if Google is unreachable.
- Several displays from one install, each with its own calendars, photos, layout, text size,
  rotation, timezone, links and address.
- Dashboard at `/admin`: tabs for Look, Calendars, Links, Photos, Access and Accounts, with a
  live preview.
- Kiosk and interactive modes; in interactive mode, link buttons (up to six, built-in or
  uploaded icons), a Google searchbar, and click-a-date for the full day.
- Per-display access tokens, and a rule that a display without one is not served to requests
  coming from outside the home network.
- Sign in to Google without a domain by pasting the final address into the dashboard.
- One multi-architecture container image (`linux/amd64`, `linux/arm64`) and a Docker Compose
  file with an optional Cloudflare Tunnel profile.
