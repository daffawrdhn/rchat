# XOXO Chat 💬 - Telegram-Style Anonymous Chat Platform

[![Project Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)](https://github.com/daffawrdhn/rchat)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Tech Stack](https://img.shields.io/badge/PHP-8.x-purple?style=for-the-badge&logo=php)](https://www.php.net/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Ratchet-orange?style=for-the-badge)](http://socketo.me/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-dodgerblue?style=for-the-badge&logo=webrtc)](https://webrtc.org/)

**XOXO Chat** is a lightweight, high-performance, and anonymous real-time communications platform designed 1:1 with the clean aesthetics of the **Telegram Light Theme**. It operates with a **Zero Storage Architecture** where all chat buffers are volatile and maintained only in memory to protect user anonymity and privacy.

---

## 🚀 Key Features

### 📡 Real-Time Channels
*   **Stranger Matchmaking:** Instantly match randomly with users. Includes gender preference filters (Male/Female) with automatic counterpart selection.
*   **Public Lounge:** A global shared chatroom containing a live online participant counter.
*   **Private Rooms:** Secure group chats created via unique room codes. Messages are encrypted in transit and rooms automatically expire and delete after 5 minutes of inactivity.

### 🖼️ Advanced Media & Audio
*   **View-Once Photos:** Received media is blurred with a "View Once" lock. A single click opens the preview modal in full screen; closing the modal immediately destroys the media node from the browser DOM.
*   **Persistent Sender Preview:** Senders can view their uploaded media multiple times without deletion.
*   **Voice Messaging:** Integrated audio recorder that encodes voice notes and delivers compressed streams instantly to peers.

### 📹 WebRTC Calls
*   **Video & Voice Calls:** Secure peer-to-peer signalling for voice/video.
*   **Aspect-Ratio-Friendly Display:** Smart layouts that prevent cropping or distorting remote feeds.
*   **Picture-in-Picture (PiP):** Drag-and-drop local preview window.
*   **Tap-to-Resize:** Toggle local video view dimensions (Small / Medium / Large).
*   **Mirror Mode:** Mirrored local video display for natural eye contact.

### ⚡ PWA, UX & SEO Polishing
*   **Typing Indicators:** Visual cues when a chat partner is typing.
*   **PWA Installable:** Installable as a Progressive Web App with caching (`sw.js`) for instant loading.
*   **Icon System:** Clean vector-drawn SVG icons instead of raw emojis for a high-fidelity interface.
*   **SEO Optimized:** Out-of-the-box SEO configuration including canonical URLs, human-written meta keywords/descriptions, social Open Graph tags, `robots.txt`, and XML sitemaps for Google indexing.

---

## 🛠️ Technology Stack
*   **Frontend:** HTML5 (semantic layout), Vanilla CSS (Telegram design system), Tailwind CSS (utilities), Vanilla ES6 JavaScript.
*   **Backend:** PHP 8.x, Ratchet WebSocket Client (`cboden/ratchet`).
*   **Dependencies:** Composer (dependency management).

---

## 📂 Directory Structure
```text
rchat/
├── src/
│   └── Chat.php          # WebSocket handler logic class (PHP Ratchet)
├── vendor/               # Third-party dependencies (Composer)
├── index.html            # Main Telegram-Style single page interface
├── main_index.html       # Public landing landing page
├── script.js             # Frontend controller (WebSocket, WebRTC, UI logic)
├── styles.css            # Custom layout rules & theme tokens
├── server.php            # WebSocket runner script (CLI entry point)
├── composer.json         # PHP project dependency configuration
├── sw.js                 # Service worker definition (PWA cache)
├── manifest.json         # PWA Manifest configuration
├── config.php            # Dynamic configuration registry (reads .env)
├── config-env.php        # Dynamic frontend config script exporter
├── .env.example          # Template environment configurations
├── robots.txt            # Crawling directives for search indexing
├── sitemap.xml           # Structured XML sitemap for crawlers
└── .htaccess             # Apache rewrite rules
```

---

## ⚙️ Local Installation & Development

### 1. Prerequisites
Make sure you have PHP 8.x and Composer installed on your development machine.

### 2. Install Dependencies
Run composer inside the project directory:
```bash
composer install
```

### 3. Run WebSocket Server
Fire up the WebSocket server on your local environment (defaults to port `8080`):
```bash
php server.php
```

### 4. Serve the Web Files
Open your browser and navigate to the project directory served by your web server (e.g. Apache, Nginx, or PHP CLI Server):
```bash
# Example using PHP built-in server
php -S localhost:8000
```
Open `http://localhost:8000/index.html` in your web browser.

---

## 🛡️ Production VPS Deployment Guide

For a production deployment, WebRTC and camera/mic access **require an SSL connection (HTTPS/WSS)**. 

### 0. Prerequisites — Fresh Ubuntu VPS

Install system packages:

```bash
sudo apt update && sudo apt upgrade -y

# PHP 8.x + required extensions (sockets & mbstring for Ratchet)
sudo apt install -y php php-cli php-sockets php-mbstring php-xml composer git

# Web server (choose one)
sudo apt install -y apache2         # Option A: Apache
# sudo apt install -y nginx         # Option B: Nginx

# SSL certificate automation
sudo apt install -y certbot python3-certbot-apache  # for Apache
# sudo apt install -y certbot python3-certbot-nginx  # for Nginx

# WebRTC TURN server (required for video/voice calls)
sudo apt install -y coturn

# Optional: Redis (for multi-server scaling — not currently used by default)
# sudo apt install -y redis-server
```

Clone the project and install PHP dependencies:

```bash
cd /var/www
sudo git clone https://github.com/daffawrdhn/rchat.git
cd rchat
composer install --no-dev

# Copy environment config
cp .env.example .env
nano .env     # adjust WS_PORT, WS_ALLOWED_ORIGINS, etc.
```

### 1. Systemd Service (Process Daemon)
To keep the WebSocket server running continuously in the background, configure a systemd daemon on your VPS.

Create service file:
```bash
sudo nano /etc/systemd/system/xoxo-server.service
```

Add the following configuration:
```ini
[Unit]
Description=WebSocket XOXO Chat Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rchat
ExecStart=/usr/bin/php server.php
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service daemon:
```bash
sudo systemctl daemon-reload
sudo systemctl enable xoxo-server.service
sudo systemctl start xoxo-server.service
```

Check the server logs and status:
```bash
sudo systemctl status xoxo-server
```

---

### 2. Web Server Proxy Configuration

To prevent exposing port `8080` directly and to enable SSL (`wss://`), proxy the WebSocket connection through your web server.

#### A. Apache Configuration (`VirtualHost`)
Enable proxy modules:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl
```

Modify your Apache config (under `<VirtualHost *:443>`):
```apache
<VirtualHost *:443>
    ServerName yourdomain.com
    DocumentRoot /var/www/rchat

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/yourdomain.com/privkey.pem

    # Proxy WebSocket /ws traffic to local Ratchet server
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/ws/(.*) ws://127.0.0.1:8080/$1 [P,L]

    ProxyPass /ws ws://127.0.0.1:8080/
    ProxyPassReverse /ws ws://127.0.0.1:8080/
</VirtualHost>
```

#### B. Nginx Configuration (`server`)
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    root /var/www/rchat;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket traffic
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Restart your web server:
```bash
# For Apache
sudo systemctl restart apache2

# For Nginx
sudo systemctl restart nginx
```

---

### 3. WebRTC STUN/TURN (COTURN) Setup
To allow WebRTC video and voice streams to connect across cellular networks or symmetric firewalls, a TURN server is required. This project uses **COTURN** configured on port `3478` of your VPS.

The client configuration in [script.js](file:///C:/Users/Think/Documents/www/rchat/script.js) matches the credentials below:
*   **STUN Server:** `stun:stun.l.google.com:19302` (Google Public STUN)
*   **TURN Server:** `turn:<YOUR_VPS_IP>:3478`
*   **Username:** `<YOUR_TURN_USERNAME>`
*   **Credential:** `<YOUR_TURN_PASSWORD>`

#### COTURN Installation on Ubuntu VPS:
1. Install coturn package:
   ```bash
   sudo apt update
   sudo apt install coturn
   ```
2. Enable coturn service on startup:
   Edit `/etc/default/coturn` and uncomment/set:
   ```ini
   TURNSERVER_ENABLED=1
   ```
3. Configure the TURN server:
   Edit `/etc/turnserver.conf` and append/modify:
   ```ini
   # Listen port
   listening-port=3478
   
   # Enable fingerprinting
   fingerprint
   
   # Use long-term credential mechanism
   lt-cred-mech
   
   # Static User Credentials (matches script.js)
   user=<YOUR_TURN_USERNAME>:<YOUR_TURN_PASSWORD>
   
   # Realm (use your domain name)
   realm=yourdomain.com
   
   # Log setting
   simple-log
   ```
4. Start COTURN daemon:
   ```bash
   sudo systemctl restart coturn
   sudo systemctl enable coturn
   ```

---

### 4. Firewall Security & VPS Manager Rules

It is critical to block direct public access to port `8080` (where PHP is listening), while exposing the web ports (`80`, `443`) and the WebRTC TURN port (`3478` on both TCP and UDP).

#### A. OS Level Firewall (`UFW`)
Configure `UFW` to restrict incoming connections:
```bash
# Allow SSH access
sudo ufw allow 22/tcp

# Allow Web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow TURN/COTURN traffic
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp

# Block external access to port 8080
sudo ufw deny 8080/tcp

# Enable Firewall
sudo ufw enable
```

Verify firewall status:
```bash
sudo ufw status verbose
```

#### B. Cloud VPS Provider Firewalls (AWS SG, DigitalOcean, Hetzner, etc.)
Always configure your cloud provider's network firewall (Security Group / Inbound Rules) to match this configuration:

| Inbound Port | Protocol | Source | Description | Action |
|---|---|---|---|---|
| `22` | TCP | `0.0.0.0/0` (or your IP) | SSH Remote Shell Access | **ALLOW** |
| `80` | TCP | `0.0.0.0/0` | HTTP Web traffic (Redirects) | **ALLOW** |
| `443` | TCP | `0.0.0.0/0` | HTTPS & WSS Proxy traffic | **ALLOW** |
| `3478` | TCP & UDP | `0.0.0.0/0` | COTURN STUN/TURN service | **ALLOW** |
| `8080` | TCP | `0.0.0.0/0` | Direct backend port | **BLOCK/REMOVE** |

> [!WARNING]
> Do NOT open port `8080` in your Cloud firewall. Doing so opens a raw unencrypted WebSocket gateway bypassing Apache/Nginx reverse proxying.

---

## 🌐 Live Demos

| Platform | URL |
|---|---|
| 🏠 **Production** | [chat.1year.site](https://chat.1year.site) |
| ☁️ **Netlify** | [xoxo-chat.netlify.app](https://xoxo-chat.netlify.app) |
| 📘 **GitHub Pages** | [daffawrdhn.github.io/rchat](https://daffawrdhn.github.io/rchat) |
| 🌊 **Surge** | [xoxo-chat.surge.sh](https://xoxo-chat.surge.sh) |

All clients connect to the same WebSocket backend (`wss://chat.1year.site/ws`). Source code per platform: `netlify/`, `docs/`, `surge/`.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
