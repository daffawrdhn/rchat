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
// --- FIX: Queue for storing candidates that arrive before the connection is ready ---
let iceCandidateQueue = [];
// ----------------------------------------------------------------------------------
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

// --- VIDEO CALLS (REFACTORED WITH FIX) ---
function toggleVideoSize() {
    videoContainer.classList.toggle('expanded');
}

async function startCall() {
    showVideoTip();
    btnCall.classList.add('hidden');
    btnHangup.classList.remove('hidden');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        localVideo.srcObject = localStream;
        videoContainer.style.display = 'flex'; // Show PIP

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
        // NOTE: We do not process the ICE queue here. We wait for user to Accept.
    }
    else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        // FIX: Process queued candidates now that Remote Description is set
        processIceQueue();
    }
    else if (signal.type === 'candidate' && signal.candidate) {
        const candidate = new RTCIceCandidate(signal.candidate);

        // FIX: Check if we are ready to add the candidate
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            await peerConnection.addIceCandidate(candidate);
        } else {
            // If not ready, save it for later
            console.log("Queueing candidate...");
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
    videoContainer.style.display = 'flex'; // Show PIP

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        localVideo.srcObject = localStream;

        // Add tracks safely
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // 1. Set Remote Description (Offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));

        // 2. FIX: PROCESS QUEUE NOW
        processIceQueue();

        // 3. Create Answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'answer', sdp: answer } }));
    } catch (e) { console.error(e); endCall(); }
}

// Helper to flush the queue
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

    // Reset Queue & Offer
    iceCandidateQueue = [];
    window.pendingOffer = null;

    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    videoContainer.style.display = 'none'; // Hide PIP

    btnCall.classList.remove('hidden');
    btnHangup.classList.add('hidden');
    incomingOverlay.classList.add('hidden');
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

// Start
initSocket();