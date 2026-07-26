# XOXO Chat — Netlify Client

Client static page untuk XOXO Chat yang di-deploy ke Netlify. Terhubung ke WebSocket production (`wss://chat.1year.site/ws`).

## Fitur (sama persis dengan chat.1year.site)

- Random chat (text/video/voice matching)
- Public lounge dengan online counter
- Private group rooms (AES-GCM encrypted)
- Image upload (view-once)
- Voice recording
- WebRTC video/voice call
- PWA support (service worker)
- Typing indicators, read receipts

## Cara Deploy ke Netlify

### 1. Push ke GitHub

```bash
git add netlify/
git commit -m "update netlify client"
git push origin main
```

### 2. Buat Site Baru di Netlify

1. Buka [https://app.netlify.com](https://app.netlify.com)
2. Klik **"Add new site" → "Import an existing project"**
3. Pilih **GitHub**, authorize jika perlu
4. Pilih repository `daffawrdhn/rchat`
5. **Base directory**: isi `netlify`
6. **Build command**: biarkan kosong
7. **Publish directory**: `.` (titik, karena base directory sudah `netlify`)
8. Klik **"Deploy site"**

### 3. Tambahkan Domain ke Allowed Origins

Setelah deploy selesai, Netlify memberi URL seperti `https://<random>.netlify.app`.

Update file `.env` di **server production** (SSH):

```bash
ssh ke server
sudo nano /var/www/rchat/.env
# Edit WS_ALLOWED_ORIGINS, tambahkan domain Netlify-mu
# Contoh: WS_ALLOWED_ORIGINS=chat.1year.site,localhost,127.0.0.1,netlify.app,kode-kamu.netlify.app
sudo systemctl restart xoxo-server
```

### 4. Buka Site

Buka `https://<random>.netlify.app` — client akan connect ke `wss://chat.1year.site/ws`.

## File Structure

| File | Fungsi |
|---|---|
| `index.html` | Main UI (sama persis dengan production) |
| `script.js` | Frontend controller (WebSocket, WebRTC, UI logic) |
| `styles.css` | Custom styles |
| `config.js` | Config statis (wsUrl, appName) — menggantikan `config-env.php` |
| `sw.js` | Service worker (cache name: `xoxo-netlify-v1.0`) |
| `manifest.json` | PWA manifest |
| `assets/` | Sound effects (msg, connect, disconnect) |
| `netlify.toml` | Konfigurasi deploy Netlify (SPA redirect) |

## Update

Setelah ada perubahan, cukup push ke `main` — Netlify auto-deploy.
