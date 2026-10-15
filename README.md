# kitchen-display

Self-hosted wall display: Google Calendar agenda (several accounts), clock and photo
background, for a portrait kitchen screen or a browser homepage. Work in progress; see
[ROADMAP.md](ROADMAP.md).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a short tour of the code.

## Develop

```bash
npm install
cp config/config.example.yaml config/config.yaml
npm run dev:server   # http://localhost:8080/api/health
npm run dev:web      # http://localhost:5173 (proxies /api)
npm run lint && npm test
```

## Photos

Put images (`.jpg`, `.png`, `.webp`, `.avif`) in `<PHOTOS_DIR>/<screen folder>`; in Docker that is
`./data/photos/<folder>`. Files are served as-is, so resize them to about 1920 px on the long
edge (a few hundred KB each): phone originals of 4000+ px are slow to decode on a Raspberry Pi.
Resize-on-upload arrives with the admin UI.

## Run in Docker

```bash
cp .env.example .env
cp config/config.example.yaml config/config.yaml
docker compose up -d
```
