# XOXO - Random Chat & Video Call App 👻

![Project Status](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Tech](https://img.shields.io/badge/Tech-PHP%20Ratchet%20%7C%20WebRTC%20%7C%20Tailwind-purple)

**XOXO** is a modern, responsive, and anonymous random chat application. It features real-time text messaging, image sharing, and robust Picture-in-Picture (PiP) video calling. The backend is powered by **PHP** using the **Ratchet** WebSocket library.

## ✨ Key Features

### 💬 Chat Experience
-   **Random Matchmaking:** Connect with strangers instantly.
-   **Image Sharing:** Compress and send images directly in chat.
-   **Typing Indicators:** See when the stranger is typing.
-   **Emojis:** Built-in emoji picker.

### 📹 Video Calls (WebRTC)
-   **Picture-in-Picture Overlay:** Drag and drop your video preview.
-   **Tap-to-Resize:** Toggle local video size (Small/Medium/Default).
-   **No-Crop Display:** Smart aspect ratio handling.
-   **Mirror Mode:** Local video is mirrored for a natural feel.

## 📂 Directory Structure

Based on your current project setup:

```text
rchat/
├── src/
│   └── Chat.php          # WebSocket Logic Class (Ratchet)
├── vendor/               # PHP Dependencies (Composer libraries)
├── index.html            # Main Chat Application
├── main_index.html       # Landing Page (1year.site)
├── script.js             # Frontend Logic (WebRTC + WebSocket)
├── styles.css            # Styling
├── server.php            # PHP WebSocket Server Entry Point
├── composer.json         # Dependency Configuration
├── sw.js                 # Service Worker (PWA)
├── manifest.json         # PWA Manifest
└── .htaccess             # Apache Configuration
