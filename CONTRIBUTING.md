# Contributing

Thanks for helping. This is a small, plain-JavaScript project and is meant to stay easy for a
beginner to read.

## Set up

```bash
npm install
cp config/config.example.yaml config/config.yaml
cp .env.example .env            # set ADMIN_PASSWORD
npm run dev:server              # API on :8080
npm run dev:web                 # dashboard and display on :5173
```

Before you send a change:

```bash
npm run lint
npm test
npm run build
```

CI runs the same three, plus a Docker build.

## Ground rules

- **Plain JavaScript, ES modules. No TypeScript.** Use JSDoc on functions that handle
  important data (calendar events, settings).
- **Small files with one job.** Server: `routes/` are thin HTTP handlers, `services/` hold
  the logic. Web: `components/` draw, `hooks/` fetch or tick, `layouts/` arrange, `admin/` is
  the dashboard. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the map; keep it current.
- **Comments explain why**, not what.
- **Secrets never reach the browser, the repository or the logs.** No calendar event titles in
  logs at the default level.
- **Everything the app stores lives under `/data`.** Ask before adding a database or another
  kind of state.
- **Colours are CSS variables** in `web/src/index.css` (`@theme`). No raw hex in components.
- **Size things on the display in `cqw` / `cqh`**, not `vw` / `vh`, so the picture can rotate.
- **Add a test** for behaviour you change. Tests use `node:test` and live in `server/test/`.
  Use a temporary data folder; never write to a real `data/`.
- **Add a dependency only with a reason.** Prefer the standard library.

## Pull requests

- Keep them focused; one idea per pull request.
- Say what you verified and what you could not (for example, "not tried on a Pi").
- Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Reporting a security problem

Please do not open a public issue; see [SECURITY.md](SECURITY.md).
