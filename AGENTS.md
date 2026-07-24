# XOXO Chat — Agent Guide

## Architecture

Single-page anonymous chat platform. No database — all state (connections, pairs, groups) is in-memory in the PHP process. Three chat modes: random stranger (text/media/video/voice matching), public lounge, private group rooms (AES-GCM encrypted, auto-delete after 5min idle).

## Key entrypoints

| Purpose | File |
|---|---|
| WebSocket server (CLI) | `server.php` |
| WebSocket handler class | `src/Chat.php` |
| Frontend controller | `script.js` |
| Main app UI | `index.html` |
| Config (reads `.env`) | `config.php` |
| Browser-exposed config | `config-env.php` (served as JS, sets `window.XOXO_CONFIG`) |

## Developer commands

```bash
composer install          # install PHP deps (cboden/ratchet)
php server.php            # start WebSocket server (default :8080)
php -S localhost:8000     # serve frontend (then open localhost:8000/index.html)
npm test                  # Puppeteer E2E test (node e2e_test.js)
```

There is no local Tailwind build — both Tailwind CSS and DaisyUI are loaded via CDN in `index.html`. No linter, formatter, or typechecker is configured.

## Configuration

Copy `.env.example` → `.env`. All settings are loaded at runtime by `config.php`. Key settings: `WS_PORT` (default 8080), `WS_PUBLIC_URL`, `WS_ALLOWED_ORIGINS`, `ANTI_SPAM_COOLDOWN` (0.5s), `IP_CONNECTION_LIMIT` (5), `GROUP_INACTIVITY_TIMEOUT` (300s).

## Testing quirks

- `e2e_test.js` launches two headless Chromium instances via Puppeteer and tests public chat, encrypted group rooms, random matching, image upload (view-once), and voice recording. Requires the WebSocket server (`php server.php`) running **before** `npm test`.
- `test_websocket.php` is a standalone PHP test script that connects to the running WebSocket server. Run it manually with `php test_websocket.php` while the server is up.
- E2E tests target `https://chat.1year.site` by default — locally, change `SITE_URL` in `e2e_test.js` or patch it.

## Production deployment

Run `php server.php` as a systemd service. Proxy WebSocket traffic (`/ws` → `ws://127.0.0.1:8080`) through Apache/Nginx with SSL. Port 8080 must not be publicly exposed. WebRTC requires HTTPS/WSS. A TURN server (COTURN) is needed for calls across restrictive networks.

## Namespace / autoload

PSR-4 autoload: `Hackertampan\Rchat\` maps to `src/`. The handler class `MyApp\Chat` lives in `src/Chat.php` (uses legacy namespace, not the PSR-4 prefix).

## Notes

- Frontend config is served as `script src="config-env.php"` — that file sets `window.XOXO_CONFIG` with `wsUrl`, `appName`, etc.
- Nicknames are randomly generated server-side (adj + noun + digits).
- Messages in random/private/group contexts are client-side AES-GCM encrypted. Public lounge messages are plaintext.
- Image uploads are compressed client-side to 800px JPEG at 60% quality, then sent as base64 over WebSocket. Max 500KB. Voice max 2MB.
- `View Once` images disappear from the receiver's DOM after the preview modal is closed.
- The `?group=<id>` URL param auto-joins a group room on load.
