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
| Netlify static client | `netlify/index.html` (+ `netlify/config.js` replaces `config-env.php`) |
| GitHub Pages client | `docs/index.html` (+ `docs/config.js` replaces `config-env.php`) |
| Surge client | `surge/index.html` (+ `surge/config.js` replaces `config-env.php`) |
| Origin check fix | `src/SafeOriginCheck.php` (subdomain matching + inline close) |
| Config for static clients | `.env.netlify` (example env for static platform deployment) |

## Developer commands

```bash
composer install          # install PHP deps (cboden/ratchet)
php server.php            # start WebSocket server (default :8080)
php -S localhost:8000     # serve frontend (then open localhost:8000/index.html)
npm test                  # Puppeteer E2E test (node e2e_test.js)
```

There is no local Tailwind build — both Tailwind CSS and DaisyUI are loaded via CDN in `index.html`. No linter, formatter, or typechecker is configured.

## Configuration

Copy `.env.example` → `.env`. All settings are loaded at runtime by `config.php`. Key settings: `WS_PORT` (default 8080), `WS_PUBLIC_URL`, `WS_ALLOWED_ORIGINS` (current: `chat.1year.site,localhost,127.0.0.1,netlify.app,github.io,surge.sh`), `ANTI_SPAM_COOLDOWN` (0.5s), `IP_CONNECTION_LIMIT` (5), `GROUP_INACTIVITY_TIMEOUT` (300s).

## Testing quirks

- `e2e_test.js` launches two headless Chromium instances via Puppeteer and tests public chat, encrypted group rooms, random matching, image upload (view-once), and voice recording. Requires the WebSocket server (`php server.php`) running **before** `npm test`.
- `test_websocket.php` is a standalone PHP test script that connects to the running WebSocket server. Run it manually with `php test_websocket.php` while the server is up.
- E2E tests target `https://chat.1year.site` by default — locally, change `SITE_URL` in `e2e_test.js` or patch it.
- **Flaky test #1**: `#public-chat-view:not(.hidden)` times out ~25% of the time. Root cause: Page2's WebSocket is still in `CONNECTING` (readyState 0) after login completes, causing `page.click('#nav-public')` to fail silently. Always re-run; second pass consistently passes.

## Production deployment

Run `php server.php` as a systemd service. Proxy WebSocket traffic (`/ws` → `ws://127.0.0.1:8080`) through Apache/Nginx with SSL. Port 8080 must not be publicly exposed. WebRTC requires HTTPS/WSS. A TURN server (COTURN) is needed for calls across restrictive networks.

## Namespace / autoload

PSR-4 autoload: `Hackertampan\Rchat\` maps to `src/`. The handler class `MyApp\Chat` lives in `src/Chat.php` (uses legacy namespace, not the PSR-4 prefix).

## Static clients (Netlify / GitHub Pages / Surge)

`netlify/`, `docs/` and `surge/` are standalone static copies of the production client. Differences from the PHP-served `index.html`:
- `config.js` replaces `config-env.php` (hardcoded `window.XOXO_CONFIG`)
- `sw.js` uses a unique cache name per platform
- All paths are relative; no PHP dependency
- WebSocket always connects to `wss://chat.1year.site/ws`

To add a new platform: copy `netlify/` → `<dir>/`, update `sw.js` cache name, write a README, add origin to `.env` on the server. Don't forget to also copy `privacy.html` and `terms.html` (needed by SW cache).

## Notes

- Frontend config is served as `script src="config-env.php"` — that file sets `window.XOXO_CONFIG` with `wsUrl`, `appName`, etc.
- Nicknames are randomly generated server-side (adj + noun + digits).
- Messages in random/private/group contexts are client-side AES-GCM encrypted. Public lounge messages are plaintext.
- Image uploads are compressed client-side to 800px JPEG at 60% quality, then sent as base64 over WebSocket. Max 500KB. Voice max 2MB.
- `View Once` images disappear from the receiver's DOM after the preview modal is closed.
- The `?group=<id>` URL param auto-joins a group room on load.
- Sidebar is full-height (`min-h-full`) with `border-r`, no pill shape. Input areas are floating pill bars (`rounded-2xl shadow-md border`) across all chat modes.
- WebSocket connects after user clicks "I Agree"; returning users (sessionStorage) auto-connect on load.
- Connection status indicator is in the sidebar below nickname, visible in all modes.
- `SafeOriginCheck.php` supports subdomain matching (e.g. `netlify.app` matches `*.netlify.app`). The parent `OriginCheck::close()` is private, so the response is sent via Guzzle directly.
- Video/voice call layout: `#video-container` has `height: 40vh` (380px desktop). When `full-height` class is added (in video/voice mode), it switches to `flex: 1` to fill available space. The JS hides `#random-chat-box` and input area during video/voice calls to prevent dead space. The `full-height` CSS rule was missing initially (only JS toggled it) — added in `styles.css`.
