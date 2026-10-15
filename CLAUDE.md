# Home-Display: rules for Claude Code

Read ROADMAP.md (plan, decisions) and docs/ARCHITECTURE.md (how the code is laid out).

- Plain JavaScript, ES modules, no TypeScript. JSDoc on calendar-data functions.
- Keep the layout: server `routes/` are thin, `services/` hold logic; web `components/` draw,
  `hooks/` fetch or tick. Code must be readable by a beginner: small files, clear names,
  comments that explain *why*.
- Secrets (tokens, calendar URLs, OAuth secret) never reach the browser, repo or logs. No
  event titles in logs at info level.
- Minimal state, only under /data. Ask before adding a database, auth system or big dependency.
- Palette and tokens are CSS variables in web/src/index.css; no hex in components.
- Every slice leaves the app runnable. Verify by running it, and report verified vs not.
- Never ask James to paste secrets into chat.
