# XOXO Chat — Netlify Client

Client static page untuk XOXO Chat yang di-deploy ke Netlify. Terhubung ke WebSocket production (`wss://chat.1year.site/ws`).

## Fitur

- Random chat (text)
- Public lounge
- Private group rooms (AES-GCM encrypted)
- Minimal & ringan (1 file HTML + CDN)

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
| `index.html` | Client utama (HTML+CSS+JS inline) |
| `netlify.toml` | Konfigurasi deploy Netlify (SPA redirect) |
| `README.md` | Tutorial ini |
## Update

Setelah ada perubahan di `netlify/index.html`, cukup push ke GitHub — Netlify auto-deploy.
