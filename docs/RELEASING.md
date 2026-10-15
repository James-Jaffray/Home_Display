# Releasing

A release is a git tag. Pushing the tag builds and publishes the container image.

## Before tagging

1. Everything you want in the release is merged to `main` and CI is green.
2. Move the **Unreleased** entries in [CHANGELOG.md](../CHANGELOG.md) under a new version
   heading with today's date.
3. Set the same version in `server/package.json` (the app reports it at `/api/health`) and in
   the root `package.json`.
4. Commit: `git commit -am "Release 0.2.0"`.

## Tag and publish

```bash
git tag v0.2.0
git push origin main --tags
```

The **Release image** workflow then:

1. runs lint, tests and the web build (and stops if any fail),
2. builds the image for `linux/amd64` and `linux/arm64`,
3. publishes `ghcr.io/<your lowercase github name>/home-display` (for this repository,
   `ghcr.io/james-jaffray/home-display`) with the tags `0.2.0`, `0.2` and `latest`.

## After the first release

- Make the package public once: GitHub profile, **Packages**, `home-display`, **Package
  settings**, change visibility to public. Otherwise people cannot pull it without logging in.
- Check the **Actions** run, then on a spare machine run `docker compose pull` using the
  published image name and confirm `/api/health` reports the new version.
- Create a GitHub **Release** from the tag and paste in that version's changelog section.

## Upgrading users

`docker compose pull && docker compose up -d`. Open displays reload themselves within a
minute. Settings and sign-ins are in the data volume and are kept.

## If a release is bad

Delete nothing. Fix forward with a patch version (`v0.2.1`). Users can pin the previous
version by changing the image tag in `docker-compose.yml`.
