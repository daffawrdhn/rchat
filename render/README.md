# XOXO Chat — Render Client

Client static untuk XOXO Chat di-deploy ke [Render](https://render.com). Isinya identik dengan production (`chat.1year.site`).

## Cara Deploy

1. **Push ke GitHub**
   ```bash
   git add render/
   git commit -m "update render client"
   git push origin main
   ```

2. **Buat Static Site di Render**
   - Dashboard Render → **"New +" → "Static Site"**
   - Hubungkan GitHub repo `daffawrdhn/rchat`
   - **Name**: `xoxo-chat` (atau terserah)
   - **Branch**: `main`
   - **Build Command**: kosongkan
   - **Publish Directory**: `render`
   - Klik **"Create Static Site"**

3. **Update Allowed Origins** (via SSH)
   ```bash
   ssh ke server
   sudo nano /var/www/rchat/.env
   # WS_ALLOWED_ORIGINS tambahkan domain render-mu, misal:
   # WS_ALLOWED_ORIGINS=chat.1year.site,localhost,127.0.0.1,netlify.app,xoxo-chat.onrender.com
   sudo systemctl restart xoxo-server
   ```

4. **Buka** `https://xoxo-chat.onrender.com`

## File Structure

| File | Fungsi |
|---|---|
| `index.html` | Main UI |
| `script.js` | Frontend controller |
| `styles.css` | Custom styles |
| `config.js` | Config statis (`wsUrl: wss://chat.1year.site/ws`) |
| `sw.js` | Service worker (cache: `xoxo-render-v1.0`) |
| `manifest.json` | PWA manifest |
| `assets/` | Sound effects |

## Update

Cukup push ke `main` — Render auto-deploy.
