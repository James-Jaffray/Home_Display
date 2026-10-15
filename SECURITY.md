# Security

## Reporting a vulnerability

Please report security problems privately, using GitHub's **Report a vulnerability** option
on the repository's Security tab (or contact the maintainer directly), rather than opening a
public issue. Include what you found, how to reproduce it, and which version you used. You
will get an answer as soon as possible.

## What is protected, and how

- **Google access:** read-only calendar permission only. Refresh tokens are stored in
  `/data/tokens.json` with owner-only permissions, are never sent to a browser, and are never
  logged.
- **Dashboard:** one shared password (`ADMIN_PASSWORD`), an HttpOnly same-site session cookie,
  a lockout after repeated wrong passwords, and a same-site check on every change.
- **Displays:** at home they are open; from outside they need a per-display access token,
  and a display without a token is refused when a request arrives from a public address.
- **Uploads:** accepted by their contents (JPEG, PNG, WebP), stored under server-chosen names,
  size-limited, and served only for displays the caller may see.
- **Browser headers:** `X-Content-Type-Options`, `Referrer-Policy: no-referrer` (so an access
  token in an address is not passed to other sites) and `X-Frame-Options: SAMEORIGIN`.

## What it does not do

- It is not a multi-user system: there is one dashboard password.
- It does not terminate HTTPS itself. Use a tunnel or reverse proxy when you expose it, and
  set `PUBLIC_BASE_URL` to the https address.
- Anyone who has a display's token address can see that display.

Keep `.env`, `config/config.yaml` and the data volume private. They are listed in
`.gitignore` and `.dockerignore`.
