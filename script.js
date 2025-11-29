// --- VARIABLES ---
let conn;
let currentMode = 'random';
let myNickname = '';
let unreadRandom = 0;
let unreadPublic = 0;

// UI Refs
const randomView = document.getElementById('random-chat-view');
const publicView = document.getElementById('public-chat-view');
const randomBox = document.getElementById('random-chat-box');
const publicBox = document.getElementById('public-chat-box');
const chatTitle = document.getElementById('chat-title');

// Status Wrapper
const statusWrapper = document.getElementById('status-wrapper');
const statusDot = document.getElementById('status-dot');
const statusBar = document.getElementById('status-bar');

const countVal = document.getElementById('count-val');
const mobileCount = document.getElementById('mobile-count');

const btnStart = document.getElementById('btn-start');
const btnNext = document.getElementById('btn-next');
const randomInputArea = document.getElementById('random-input-area');
const randomInput = document.getElementById('random-msg-input');
const publicInput = document.getElementById('public-msg-input');

// Video & WebRTC
let localStream;
let peerConnection;
let isMuted = false;
let isCameraOff = false;

// Queue for storing candidates that arrive before the connection is ready
let iceCandidateQueue = [];

const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const videoContainer = document.getElementById('video-container');
const btnCall = document.getElementById('btn-call');
const btnHangup = document.getElementById('btn-hangup');
const incomingOverlay = document.getElementById('incoming_call_overlay');
const rtcConfig = {
    iceServers: [
        // Google's Public STUN (Keep this as backup/first attempt)
        { urls: 'stun:stun.l.google.com:19302' },

        // YOUR NEW TURN SERVER
        {
            urls: 'turn:YOUR_PUBLIC_IP:3478',
            username: 'johndoe',
            credential: 'johndoe-password'
        }
    ]
};

// Emojis
const emojis = ['😀', '😂', '😍', '😭', '😎', '😡', '💀', '👻', '👍', '👎', '👋', '🔥', '❤️', '💔', '💩'];
const renderEmojis = (id, ctx) => document.getElementById(id).innerHTML = emojis.map(e => `<button class="btn btn-ghost btn-sm text-xl hover:bg-white/10" onclick="insertEmoji('${e}', '${ctx}')">${e}</button>`).join('');
renderEmojis('emoji-grid-random', 'random');
renderEmojis('emoji-grid-public', 'public');

function initSocket() {
    // CHANGE THIS URL TO YOUR WEBSOCKET SERVER
    const socketUrl = 'wss://chat.1year.site/ws';
    conn = new WebSocket(socketUrl);

    conn.onopen = function () {
        updateStatus("Connected", "success");
        conn.send(JSON.stringify({ action: 'join_room', room: 'random' }));

        if (currentMode === 'random') {
            btnStart.classList.remove('hidden');
            btnNext.classList.add('hidden');
            randomInputArea.classList.add('hidden');
        }
    };

    conn.onclose = function () {
        updateStatus("Disconnected", "error");
        setTimeout(initSocket, 3000);
        setRandomUI('disconnected');
        endCall(true);
    };

    conn.onmessage = function (e) {
        const data = JSON.parse(e.data);

        if (data.status === 'identity') {
            myNickname = data.nickname;
            document.getElementById('sidebar-nickname').innerText = myNickname;
        }
        else if (data.status === 'stats') {
            countVal.innerText = data.count;
            mobileCount.innerText = data.count;
        }
        else if (data.status === 'system') {
            logSystem(currentMode === 'random' ? randomBox : publicBox, `⚠️ ${data.msg}`);
        }
        else if (data.status === 'waiting') {
            setRandomUI('waiting');
            logSystem(randomBox, data.msg);
        }
        else if (data.status === 'connected') {
            setRandomUI('connected');
            logSystem(randomBox, "You are connected with a Stranger.");
        }
        else if (data.status === 'disconnected') {
            setRandomUI('disconnected_partner');
            logSystem(randomBox, "Stranger left.");
            endCall(true);
        }
        else if (data.status === 'message') {
            if (currentMode !== 'random') { unreadRandom++; updateBadges(); }
            showTyping(false);
            logMessage(randomBox, 'stranger', 'Stranger', data.msg, data.type);
        }
        else if (data.status === 'public_msg') {
            if (currentMode !== 'public') { unreadPublic++; updateBadges(); }
            logMessage(publicBox, 'other', data.name, data.msg, data.type);
        }
        else if (data.status === 'typing') showTyping(true);
        else if (data.status === 'call_signal') handleSignalMessage(data.signal);
    };
}

// --- UI UTILS ---
function updateStatus(text, type) {
    statusBar.innerText = text;
    statusDot.className = `w-2 h-2 rounded-full ${type === 'success' ? 'bg-success shadow-[0_0_10px_#22c55e]' : 'bg-error'}`;
}
function updateBadges() {
    const bRandom = document.getElementById('badge-random');
    const bPublic = document.getElementById('badge-public');
    if (unreadRandom > 0) { bRandom.innerText = unreadRandom; bRandom.classList.remove('scale-0'); }
    else bRandom.classList.add('scale-0');
    if (unreadPublic > 0) { bPublic.innerText = unreadPublic; bPublic.classList.remove('scale-0'); }
    else bPublic.classList.add('scale-0');
}
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('my-drawer-2').checked = false;
    document.getElementById('nav-random').classList.remove('active');
    document.getElementById('nav-public').classList.remove('active');
    document.getElementById(`nav-${mode}`).classList.add('active');

    if (mode === 'random') {
        randomView.classList.remove('hidden');
        publicView.classList.add('hidden');
        chatTitle.innerText = "Random Chat";
        statusWrapper.classList.remove('invisible');
        unreadRandom = 0; updateBadges();
    } else {
        randomView.classList.add('hidden');
        publicView.classList.remove('hidden');
        chatTitle.innerText = "Public Lounge";
        statusWrapper.classList.add('invisible');
        unreadPublic = 0; updateBadges();
        setTimeout(() => publicBox.scrollTop = publicBox.scrollHeight, 100);
    }
}
function setRandomUI(state) {
    btnNext.classList.add('hidden');
    randomInputArea.classList.add('hidden');
    btnStart.classList.add('hidden');
    randomInputArea.classList.remove('flex');

    if (state === 'waiting') updateStatus("Searching...", "warning");
    else if (state === 'connected') {
        btnNext.classList.remove('hidden');
        randomInputArea.classList.remove('hidden');
        randomInputArea.classList.add('flex');
        if (currentMode === 'random') updateStatus("Online", "success");
    } else if (state === 'disconnected_partner') {
        btnNext.classList.remove('hidden');
        if (currentMode === 'random') updateStatus("Partner Left", "error");
        showTyping(false);
    }
}

// Image Modal
function openImageModal(src) {
    const modal = document.getElementById('img_modal');
    const modalImg = document.getElementById('img_modal_src');
    modalImg.src = src;
    modal.showModal();
}

function logMessage(container, type, name, msg, msgType = 'text') {
    const isMe = type === 'you';
    const align = isMe ? 'chat-end' : 'chat-start';
    const bubbleColor = isMe ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content';
    const avatar = isMe ? '😎' : (type === 'stranger' ? '🕵️' : '👤');

    let contentHtml = '';
    if (msgType === 'image') {
        contentHtml = `<img src="${msg}" class="rounded-lg max-w-[200px] border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" onclick="openImageModal(this.src)">`;
    } else {
        contentHtml = msg;
    }

    const html = `
    <div class="chat ${align} msg-anim">
        <div class="chat-image avatar placeholder"><div class="bg-neutral-focus text-neutral-content rounded-full w-8"><span>${avatar}</span></div></div>
        <div class="chat-header text-xs opacity-50 mb-1 ml-1">${name}</div>
        <div class="chat-bubble ${bubbleColor} shadow-md text-sm break-words">${contentHtml}</div>
    </div>`;
    container.innerHTML += html;
    container.scrollTop = container.scrollHeight;
}

function logSystem(container, msg) {
    container.innerHTML += `<div class="flex items-center justify-center my-4 opacity-60 msg-anim"><span class="text-xs bg-base-200 px-3 py-1 rounded-full border border-white/5">${msg}</span></div>`;
    container.scrollTop = container.scrollHeight;
}

// --- ACTIONS ---
function startRandomChat() {
    if (conn.readyState !== WebSocket.OPEN) return;
    conn.send(JSON.stringify({ action: 'find_partner' }));
    btnStart.classList.add('hidden');
}
function nextPartner() {
    randomBox.innerHTML = '';
    showTyping(false);
    endCall();
    conn.send(JSON.stringify({ action: 'next' }));
}
function sendMessage(context, type = 'text', content = null) {
    const input = context === 'random' ? randomInput : publicInput;
    const text = content || input.value.trim();
    if (!text) return;

    logMessage(context === 'random' ? randomBox : publicBox, 'you', 'You', text, type);
    conn.send(JSON.stringify({ action: 'message', content: text, context: context, type: type }));

    if (type === 'text') { input.value = ''; input.focus(); }
}
function handleInput(e, ctx) { if (e.key === 'Enter') sendMessage(ctx); }
function insertEmoji(e, ctx) {
    const el = ctx === 'random' ? randomInput : publicInput;
    el.value += e; el.focus();
}

// --- IMAGE HANDLING ---
function triggerUpload() { document.getElementById('img-upload').click(); }

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 5 * 1024 * 1024) { alert("Image too large (Max 5MB origin)"); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize logic (Max 800px)
                const MAX_SIZE = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Compress (JPEG 60%)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                sendMessage(currentMode, 'image', dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        input.value = ''; // Reset
    }
}

// --- TYPING ---
let typingTimer; let lastTypingTime = 0;
function sendTypingSignal() {
    const now = Date.now();
    if (now - lastTypingTime > 2000 && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify({ action: 'typing' }));
        lastTypingTime = now;
    }
}
function showTyping(show) {
    const ind = document.getElementById('typing-indicator');
    ind.style.opacity = show ? '1' : '0';
    if (show) { clearTimeout(typingTimer); typingTimer = setTimeout(() => ind.style.opacity = '0', 3000); }
}

// --- VIDEO CALLS (PICTURE-IN-PICTURE OVERLAY) ---

function toggleMic() {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks()[0].enabled = !isMuted;
        const btn = document.getElementById('btn-mic');
        // Update Icon
        if (isMuted) {
            btn.classList.add('bg-red-500', 'hover:bg-red-600');
            btn.classList.remove('bg-black/50');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12.732a1 1 0 01-1.707.707l-3.515-3.515H3a1 1 0 01-1-1v-4a1 1 0 011-1h1.778l3.515-3.515a1 1 0 011.09-.231zM12.71 6.29a1 1 0 01.037 1.414l-1.414 1.414 1.414 1.414a1 1 0 01-1.414 1.414l-1.414-1.414-1.414 1.414a1 1 0 01-1.414-1.414l1.414-1.414-1.414-1.414a1 1 0 111.414-1.414l1.414 1.414 1.414-1.414a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        } else {
            btn.classList.remove('bg-red-500', 'hover:bg-red-600');
            btn.classList.add('bg-black/50');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" /></svg>`;
        }
    }
}

function toggleCam() {
    if (localStream) {
        isCameraOff = !isCameraOff;
        localStream.getVideoTracks()[0].enabled = !isCameraOff;
        const btn = document.getElementById('btn-cam');
        if (isCameraOff) {
            btn.classList.add('bg-red-500', 'hover:bg-red-600');
            btn.classList.remove('bg-black/50');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>`;
        } else {
            btn.classList.remove('bg-red-500', 'hover:bg-red-600');
            btn.classList.add('bg-black/50');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>`;
        }
    }
}


async function startCall() {
    showVideoTip();
    btnCall.classList.add('hidden');
    btnHangup.classList.remove('hidden');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        localVideo.srcObject = localStream;

        // SHOW CONTAINER (BLOCK FOR RELATIVE)
        videoContainer.style.display = 'block';
        videoContainer.classList.remove('hidden');

        createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'offer', sdp: offer } }));
        logSystem(randomBox, "🎥 Calling stranger...");
    } catch (err) {
        console.error(err);
        alert("Camera/Microphone access required!"); endCall();
    }
}

async function handleSignalMessage(signal) {
    if (!peerConnection) createPeerConnection();

    if (signal.type === 'offer') {
        incomingOverlay.classList.remove('hidden');
        window.pendingOffer = signal.sdp;
    }
    else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        processIceQueue();
    }
    else if (signal.type === 'candidate' && signal.candidate) {
        const candidate = new RTCIceCandidate(signal.candidate);
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            await peerConnection.addIceCandidate(candidate);
        } else {
            iceCandidateQueue.push(candidate);
        }
    }
    else if (signal.type === 'hangup') {
        endCall(true);
        logSystem(randomBox, "Call ended.");
    }
}

async function acceptCall() {
    incomingOverlay.classList.add('hidden');
    btnCall.classList.add('hidden');
    btnHangup.classList.remove('hidden');

    // SHOW CONTAINER
    videoContainer.style.display = 'block';
    videoContainer.classList.remove('hidden');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        localVideo.srcObject = localStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));
        processIceQueue();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'answer', sdp: answer } }));
    } catch (e) { console.error(e); endCall(); }
}

async function processIceQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (e) {
            console.error("Error adding queued candidate", e);
        }
    }
}

function rejectCall() {
    incomingOverlay.classList.add('hidden');
    conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'hangup' } }));
}

function createPeerConnection() {
    if (peerConnection) return;
    peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnection.onicecandidate = (e) => {
        if (e.candidate) conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'candidate', candidate: e.candidate } }));
    };
    peerConnection.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
}

function endCall(isRemote = false) {
    if (!isRemote && conn && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'hangup' } }));
    }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

    iceCandidateQueue = [];
    window.pendingOffer = null;

    remoteVideo.srcObject = null;
    localVideo.srcObject = null;

    // HIDE CONTAINER
    videoContainer.style.display = 'none';
    videoContainer.classList.add('hidden');

    btnCall.classList.remove('hidden');
    btnHangup.classList.add('hidden');
    incomingOverlay.classList.add('hidden');

    // Reset Controls State
    isMuted = false;
    isCameraOff = false;
}

function toggleTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'night' ? 'cupcake' : 'night');
}

// --- NEW: USER AGREEMENT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('agreement_modal');

    // Check if already agreed in this session
    if (!sessionStorage.getItem('terms_accepted')) {
        modal.showModal();

        // Prevent closing with ESC key
        modal.addEventListener('cancel', (event) => {
            event.preventDefault();
        });
    }
});

function acceptTerms() {
    sessionStorage.setItem('terms_accepted', 'true');
    document.getElementById('agreement_modal').close();

    // Play a subtle sound or animation if you like
    console.log("Terms accepted.");
}

// --- NEW: VIDEO TIP LOGIC ---
function showVideoTip() {
    // Only show this once per session to avoid annoying the user
    if (!sessionStorage.getItem('video_tip_shown')) {
        document.getElementById('video_tip_modal').showModal();
        sessionStorage.setItem('video_tip_shown', 'true');
    }
}

function checkIOSInstall() {
    // 1. Detect if device is iOS (iPhone, iPad, iPod)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

    // 2. Detect if already running in "App Mode" (Standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 3. If it is iOS AND NOT installed yet -> Show a custom instruction
    if (isIOS && !isStandalone) {
        // Create a simple toast/popup
        const toast = document.createElement('div');
        toast.className = "fixed bottom-4 left-4 right-4 bg-base-100 p-4 rounded-xl border border-white/10 shadow-2xl z-50 flex flex-col gap-2 msg-anim";
        toast.innerHTML = `
          <div class="flex justify-between items-start">
              <div>
                  <h3 class="font-bold text-sm">Install XOXO App 📲</h3>
                  <p class="text-xs opacity-70 mt-1">For the best experience, add this to your home screen.</p>
              </div>
              <button onclick="this.parentElement.parentElement.remove()" class="btn btn-xs btn-circle btn-ghost">✕</button>
          </div>
          <div class="text-xs flex items-center gap-2 mt-2 bg-base-200 p-2 rounded">
              <span>1. Tap</span> 
              <span class="text-xl leading-none">📤</span> 
              <span>(Share) in Safari bar</span>
          </div>
          <div class="text-xs flex items-center gap-2">
              <span>2. Scroll down & tap</span>
              <span class="font-bold">"Add to Home Screen" ➕</span>
          </div>
      `;
        document.body.appendChild(toast);
    }
}

// Run this check 2 seconds after load
setTimeout(checkIOSInstall, 2000);

// Start
initSocket();