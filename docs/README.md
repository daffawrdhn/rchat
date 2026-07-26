# XOXO Chat — GitHub Pages Client

Static client untuk XOXO Chat via GitHub Pages. Isinya identik dengan `chat.1year.site`.

## Cara Aktifkan

1. **Push ke GitHub**
   ```bash
   git add docs/
   git commit -m "update gh-pages client"
   git push origin main
   ```

2. **Settings repo** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: `/docs`
   - Save

3. **Update Allowed Origins** (via SSH)
   ```bash
   ssh ke server
   sudo nano /var/www/rchat/.env
   # WS_ALLOWED_ORIGINS tambahkan:
   # WS_ALLOWED_ORIGINS=chat.1year.site,localhost,127.0.0.1,netlify.app,daffawrdhn.github.io
   sudo systemctl restart xoxo-server
   ```

4. Buka `https://daffawrdhn.github.io/rchat/`
