// --- VARIABLES ---
let conn;
let currentMode = 'random';
let myNickname = '';
let myFlag = '🏳️';
let unreadRandom = 0;
let unreadVideo = 0;
let unreadVoice = 0;
let unreadPublic = 0;
let unreadGroup = 0;
let isSearching = false;
let randomPartnerName = 'Stranger';
let currentGroupId = null;
let matchedMode = null;

// UI Refs
const randomView = document.getElementById('random-chat-view');
const publicView = document.getElementById('public-chat-view');
const groupView = document.getElementById('group-chat-view');
const randomBox = document.getElementById('random-chat-box');
const publicBox = document.getElementById('public-chat-box');
const groupBox = document.getElementById('group-chat-box');
const chatTitle = document.getElementById('chat-title');

// Status Wrapper
const statusWrapper = document.getElementById('status-wrapper');
const statusDot = document.getElementById('status-dot');
const statusBar = document.getElementById('status-bar');

const countVal = document.getElementById('count-val');
const mobileCount = document.getElementById('mobile-count');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnNextHeader = document.getElementById('btn-next-header');
const randomInputArea = document.getElementById('random-input-area');
const btnVoiceCall = document.getElementById('btn-voice-call');
const randomInput = document.getElementById('random-msg-input');
const publicInput = document.getElementById('public-msg-input');
const groupInput = document.getElementById('group-msg-input');

// Video & WebRTC
let localStream;
let peerConnection;
let isMuted = false;
let isCameraOff = false;
let localVideoSizeState = 0; // 0: Default, 1: Big, 2: Small

let iceCandidateQueue = [];

const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const videoContainer = document.getElementById('video-container');
const btnCall = document.getElementById('btn-call');
const btnHangup = document.getElementById('btn-hangup');
const incomingOverlay = document.getElementById('incoming_call_overlay');
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:20.2.138.225:3478',
            username: 'johndoe',
            credential: 'johndoe-password'
        }
    ]
};

// --- SOUND EFFECTS ---
const sounds = {
    msg: new Audio('./assets/msg.mp3'),
    connect: new Audio('./assets/connect.mp3'),
    disconnect: new Audio('./assets/disconnect.mp3')
};
Object.values(sounds).forEach(s => s.load());

function playAudio(type) {
    if (sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(e => {
            if (e.name !== 'NotSupportedError' && e.name !== 'NotAllowedError') {
                console.log("Audio play failed:", e);
            }
        });
    }
}

// Emojis
const emojis = ['😀', '😂', '😍', '😭', '😎', '😡', '💀', '👻', '👍', '👎', '👋', '🔥', '❤️', '💔', '💩'];
const renderEmojis = (id, ctx) => document.getElementById(id).innerHTML = emojis.map(e => `<button class="btn btn-ghost btn-sm text-xl hover:bg-base-content/10" onclick="insertEmoji('${e}', '${ctx}')">${e}</button>`).join('');
renderEmojis('emoji-grid-random', 'random');
renderEmojis('emoji-grid-public', 'public');
renderEmojis('emoji-grid-group', 'group');

function initSocket() {
    // CHANGE THIS URL TO YOUR WEBSOCKET SERVER
    const socketUrl = 'wss://chat.1year.site/ws';
    conn = new WebSocket(socketUrl);

    conn.onopen = function () {
        updateStatus("Connected", "success");
        conn.send(JSON.stringify({ action: 'join_room', room: 'random' }));
        conn.send(JSON.stringify({ action: 'set_profile', flag: myFlag }));

        if (currentMode === 'random' || currentMode === 'video' || currentMode === 'voice') {
            btnStart.classList.remove('hidden');
            btnStop.classList.add('hidden');
            randomInputArea.classList.add('hidden');
            
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) startOverlay.classList.remove('hidden');
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
            myFlag = data.flag || '🏳️';
            document.getElementById('sidebar-nickname').innerText = myNickname + ' ' + myFlag;
        }
        else if (data.status === 'stats') {
            countVal.innerText = data.count;
            mobileCount.innerText = data.count;
        }
        else if (data.status === 'system') {
            logSystem((currentMode === 'random' || currentMode === 'video' || currentMode === 'voice') ? randomBox : publicBox, `⚠️ ${data.msg}`);
        }
        else if (data.status === 'waiting') {
            if (isSearching) {
                setRandomUI('waiting');
                logSystem(randomBox, data.msg);
            }
        }
        else if (data.status === 'connected') {
            if (data.shared_key) currentAesKey = data.shared_key;
            randomPartnerName = data.nickname || 'Stranger';
            matchedMode = data.mode || 'text';
            isSearching = false;
            playAudio('connect');
            setRandomUI('connected');
            notifyBackground(`${randomPartnerName} Found!`, `You are now connected with ${randomPartnerName}.`);
            logSystem(randomBox, `You are connected with ${randomPartnerName}.`);
            
            let modeTitle = 'Meet Random';
            if (matchedMode === 'video') modeTitle = 'Random Video';
            else if (matchedMode === 'voice') modeTitle = 'Random Call';
            chatTitle.innerText = `${modeTitle} (${randomPartnerName})`;

            const videoNameSpan = document.getElementById('video-partner-name');
            if (videoNameSpan) videoNameSpan.innerText = randomPartnerName;

            // Automatically start call based on matched mode
            if (matchedMode === 'video' && data.initiator) {
                startCall(false);
            } else if (matchedMode === 'voice' && data.initiator) {
                startCall(true);
            }
        }
        else if (data.status === 'disconnected') {
            playAudio('disconnect');
            setRandomUI('disconnected_partner');
            logSystem(randomBox, `${randomPartnerName} left.`);
            endCall(true);
            randomPartnerName = 'Stranger';
            
            let modeTitle = 'Meet Random';
            if (currentMode === 'video') modeTitle = 'Random Video';
            else if (currentMode === 'voice') modeTitle = 'Random Call';
            chatTitle.innerText = modeTitle;

            const videoNameSpan = document.getElementById('video-partner-name');
            if (videoNameSpan) videoNameSpan.innerText = 'Stranger';
            matchedMode = null;
        }
        else if (data.status === 'message') {
            if (currentMode !== matchedMode) { 
                if (matchedMode === 'video') {
                    unreadVideo++;
                } else if (matchedMode === 'voice') {
                    unreadVoice++;
                } else {
                    unreadRandom++;
                }
                updateBadges(); 
            }
            playAudio('msg');
            showTyping(false);
            const decrypted = decryptMsg(data.msg, currentAesKey);
            logMessage(randomBox, 'stranger', randomPartnerName, decrypted, data.type);
            notifyBackground(`New message from ${randomPartnerName}`, decrypted.substring(0, 50) + (data.type === 'image' ? ' [Image]' : (data.type === 'audio' ? ' [Audio]' : '')));
            if (document.hasFocus()) conn.send(JSON.stringify({ action: 'read', context: matchedMode || 'random' }));
        }
        else if (data.status === 'public_msg') {
            if (currentMode !== 'public') { unreadPublic++; updateBadges(); }
            logMessage(publicBox, 'other', data.name, data.msg, data.type);
            notifyBackground("Public Lounge", data.name + ": " + data.msg.substring(0, 30));
        }
        else if (data.status === 'group_msg') {
            if (currentMode !== 'group') { unreadGroup++; updateBadges(); }
            const decrypted = decryptMsg(data.msg, rawCustomRoomCode);
            logMessage(groupBox, 'other', data.name, decrypted, data.type);
            notifyBackground("Custom Room", data.name + ": " + decrypted.substring(0, 30));
            if (document.hasFocus()) conn.send(JSON.stringify({ action: 'read', context: 'group' }));
        }
        else if (data.status === 'read') {
            const box = (data.context === 'random' || data.context === 'video' || data.context === 'voice') ? randomBox : (data.context === 'group' ? groupBox : publicBox);
            const receipts = box.querySelectorAll('.read-receipt');
            receipts.forEach(r => {
                r.innerText = '✓✓';
                r.classList.add('text-blue-500');
            });
        }
        else if (data.status === 'group_joined') {
            currentGroupId = data.group_id;
            setGroupUI('active', data.group_id);
            logSystem(groupBox, data.msg);
            
            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('group', data.group_id);
            window.history.pushState({}, '', url);
        }
        else if (data.status === 'group_kicked') {
            currentGroupId = null;
            setGroupUI('idle');
            const url = new URL(window.location);
            url.searchParams.delete('group');
            window.history.pushState({}, '', url);
        }
        else if (data.status === 'group_system') {
            logSystem(groupBox, data.msg);
        }
        else if (data.status === 'typing') {
            const ctx = data.context || 'random';
            const name = data.name || ((ctx === 'random' || ctx === 'video') ? randomPartnerName : 'Stranger');
            showTyping(true, ctx, name);
        }
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
    const bVideo = document.getElementById('badge-video');
    const bVoice = document.getElementById('badge-voice');
    const bPublic = document.getElementById('badge-public');
    const bGroup = document.getElementById('badge-group');

    if (unreadRandom > 0) { bRandom.innerText = unreadRandom; bRandom.classList.remove('scale-0'); }
    else bRandom.classList.add('scale-0');

    if (bVideo) {
        if (unreadVideo > 0) { bVideo.innerText = unreadVideo; bVideo.classList.remove('scale-0'); }
        else bVideo.classList.add('scale-0');
    }

    if (bVoice) {
        if (unreadVoice > 0) { bVoice.innerText = unreadVoice; bVoice.classList.remove('scale-0'); }
        else bVoice.classList.add('scale-0');
    }

    if (unreadPublic > 0) { bPublic.innerText = unreadPublic; bPublic.classList.remove('scale-0'); }
    else bPublic.classList.add('scale-0');

    if (unreadGroup > 0) { bGroup.innerText = unreadGroup; bGroup.classList.remove('scale-0'); }
    else bGroup.classList.add('scale-0');
}

function notifyBackground(title, body) {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body });
    }
}
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('my-drawer-2').checked = false;
    document.getElementById('nav-random').classList.remove('active');
    document.getElementById('nav-video')?.classList.remove('active');
    document.getElementById('nav-voice')?.classList.remove('active');
    document.getElementById('nav-public').classList.remove('active');
    document.getElementById('nav-group').classList.remove('active');
    document.getElementById(`nav-${mode}`).classList.add('active');

    if (mode === 'random' || mode === 'video' || mode === 'voice') {
        randomView.classList.remove('hidden');
        publicView.classList.add('hidden');
        groupView.classList.add('hidden');
        
        const startIcon = document.getElementById('start-icon');
        const startHeading = document.getElementById('start-heading');
        const startDesc = document.getElementById('start-desc');
        
        if (mode === 'video') {
            chatTitle.innerText = "Random Video";
            if (startIcon) startIcon.innerText = "🎥";
            if (startHeading) startHeading.innerText = "Video Matchmaking";
            if (startDesc) startDesc.innerText = "Match and start high-quality video call instantly and anonymously with strangers.";
            btnStart.innerText = "Start Video Search";
            unreadVideo = 0;
        } else if (mode === 'voice') {
            chatTitle.innerText = "Random Call";
            if (startIcon) startIcon.innerText = "📞";
            if (startHeading) startHeading.innerText = "Voice Matchmaking";
            if (startDesc) startDesc.innerText = "Match and start voice calls instantly and anonymously with strangers.";
            btnStart.innerText = "Start Voice Search";
            unreadVoice = 0;
        } else {
            chatTitle.innerText = "Meet Random";
            if (startIcon) startIcon.innerText = "💬";
            if (startHeading) startHeading.innerText = "Stranger Matchmaking";
            if (startDesc) startDesc.innerText = "Match randomly, type secretly, or share video calls with stranger completely anonymously.";
            btnStart.innerText = "Start Searching";
            unreadRandom = 0;
        }
        
        statusWrapper.classList.remove('invisible');
        updateBadges();
        
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) {
            if (!isSearching && randomInputArea.classList.contains('hidden')) {
                startOverlay.classList.remove('hidden');
            } else {
                startOverlay.classList.add('hidden');
            }
        }
    } else if (mode === 'public') {
        randomView.classList.add('hidden');
        publicView.classList.remove('hidden');
        groupView.classList.add('hidden');
        chatTitle.innerText = "Public Lounge";
        statusWrapper.classList.add('invisible');
        unreadPublic = 0; updateBadges();
        setTimeout(() => publicBox.scrollTop = publicBox.scrollHeight, 100);
    } else if (mode === 'group') {
        randomView.classList.add('hidden');
        publicView.classList.add('hidden');
        groupView.classList.remove('hidden');
        chatTitle.innerText = "Private Room";
        statusWrapper.classList.add('invisible');
        unreadGroup = 0; updateBadges();
        setTimeout(() => groupBox.scrollTop = groupBox.scrollHeight, 100);
    }
}
function setRandomUI(state) {
    btnNextHeader.classList.add('hidden');
    btnNextHeader.classList.remove('flex');
    randomInputArea.classList.add('hidden');
    btnStart.classList.add('hidden');
    btnStop.classList.add('hidden');
    randomInputArea.classList.remove('flex');
    
    const startOverlay = document.getElementById('start-overlay');

    if (state === 'waiting') {
        updateStatus("Searching...", "warning");
        btnStop.classList.remove('hidden');
        if (startOverlay) startOverlay.classList.add('hidden');
    }
    else if (state === 'connected') {
        btnNextHeader.classList.remove('hidden');
        btnNextHeader.classList.add('flex');
        
        if (matchedMode === 'random') {
            randomInputArea.classList.remove('hidden');
            randomInputArea.classList.add('flex');
            randomBox.classList.remove('hidden');
            btnCall.classList.remove('hidden');
            btnVoiceCall.classList.remove('hidden');
            
            const videoContainer = document.getElementById('video-container');
            if (videoContainer) videoContainer.classList.remove('full-height');
        } else {
            randomInputArea.classList.add('hidden');
            randomBox.classList.add('hidden');
            btnCall.classList.add('hidden');
            btnVoiceCall.classList.add('hidden');
            
            const videoContainer = document.getElementById('video-container');
            if (videoContainer) {
                videoContainer.classList.add('full-height');
                videoContainer.style.display = 'block';
                videoContainer.classList.remove('hidden');
            }
        }
        
        if (currentMode === 'random' || currentMode === 'video' || currentMode === 'voice') updateStatus("Online", "success");
        if (startOverlay) startOverlay.classList.add('hidden');
    } else if (state === 'disconnected_partner') {
        if (currentMode === 'random' || currentMode === 'video' || currentMode === 'voice') updateStatus("Partner Left", "error");
        showTyping(false);
        btnStart.classList.remove('hidden');
        if (startOverlay) startOverlay.classList.remove('hidden');
        
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.classList.remove('full-height');
            videoContainer.style.display = 'none';
        }
        randomBox.classList.remove('hidden');
    } else if (state === 'disconnected') {
        btnStart.classList.remove('hidden');
        if (startOverlay) startOverlay.classList.remove('hidden');
        
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.classList.remove('full-height');
            videoContainer.style.display = 'none';
        }
        randomBox.classList.remove('hidden');
    }
}

function openImageModal(src) {
    const modal = document.getElementById('img_modal');
    const modalImg = document.getElementById('img_modal_src');
    modalImg.src = src;
    modal.showModal();
}

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

async function toggleRecording(context) {
    const btnId = `record-btn-${context}`;
    const btn = document.getElementById(btnId);
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    // Send huge base64 directly via WebSocket (Zero Storage Architecture)
                    sendMessage(context, 'audio', reader.result);
                };
            };
            
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('text-red-500', 'animate-pulse');
        } catch (err) {
            alert("Microphone access denied.");
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        btn.classList.remove('text-red-500', 'animate-pulse');
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

function revealAndPreviewImage(e, el, src) {
    const img = el.querySelector('img');
    const overlay = el.querySelector('.blur-overlay');
    if (img && img.classList.contains('blur-md')) {
        img.classList.remove('blur-md');
        if (overlay) overlay.remove();
        e.stopPropagation();
    } else {
        openImageModal(src);
    }
}

function logMessage(container, type, name, msg, msgType = 'text') {
    const isMe = type === 'you';
    const align = isMe ? 'chat-end' : 'chat-start';
    const bubbleColor = isMe ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content';
    const avatar = isMe ? '😎' : (type === 'stranger' ? '🕵️' : '👤');

    let contentHtml = '';
    if (msgType === 'image') {
        if (isMe) {
            contentHtml = `<img src="${msg}" class="rounded-lg max-w-[200px] border border-base-content/10 cursor-pointer hover:opacity-80 transition-opacity" onclick="openImageModal(this.src)">`;
        } else {
            contentHtml = `
            <div class="relative overflow-hidden rounded-lg max-w-[200px] cursor-pointer group" onclick="revealAndPreviewImage(event, this, '${msg}')">
                <img src="${msg}" class="blur-md transition-all duration-300 max-w-full border border-base-content/10">
                <div class="blur-overlay absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-2 transition-opacity group-hover:bg-black/50 pointer-events-none">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-white flex items-center gap-1">
                        <span>👁️</span> Reveal Image
                    </span>
                </div>
            </div>`;
        }
    } else if (msgType === 'audio') {
        contentHtml = `<audio controls src="${msg}" class="max-w-[200px] h-10"></audio>`;
    } else {
        let safeMsg = escapeHTML(msg);
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        contentHtml = safeMsg.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" class="link hover:text-accent font-bold underline cursor-pointer">${url}</a>`;
        });
    }

    const receipt = isMe ? `<span class="read-receipt text-xs opacity-50 ml-2">✓</span>` : '';
    const html = `
    <div class="chat ${align} msg-anim">
        <div class="chat-image avatar placeholder"><div class="bg-neutral-focus text-neutral-content rounded-full w-8"><span>${avatar}</span></div></div>
        <div class="chat-header text-xs opacity-50 mb-1 ml-1">${name} ${receipt}</div>
        <div class="chat-bubble ${bubbleColor} shadow-md text-sm break-words">${contentHtml}</div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
}

function logSystem(container, msg) {
    const html = `<div class="flex items-center justify-center my-4 opacity-60 msg-anim"><span class="text-xs bg-base-200 px-3 py-1 rounded-full border border-base-content/5">${msg}</span></div>`;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
}

// --- ACTIONS ---
function startRandomChat() {
    if (conn.readyState !== WebSocket.OPEN) return;
    isSearching = true;

    // Get gender preferences
    const gender = document.getElementById('user-gender')?.value || 'any';
    const targetGender = document.getElementById('target-gender')?.value || 'any';

    // Save to localStorage
    localStorage.setItem('user_gender', gender);
    localStorage.setItem('target_gender', targetGender);

    conn.send(JSON.stringify({ 
        action: 'find_partner', 
        mode: currentMode,
        gender: gender,
        targetGender: targetGender
    }));

    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    updateStatus("Searching...", "warning");
    
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) startOverlay.classList.add('hidden');
}

function stopRandomChat() {
    isSearching = false;
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
    updateStatus("Idle", "warning");
    logSystem(randomBox, "Search canceled.");
    conn.send(JSON.stringify({ action: 'cancel_search' }));
    randomPartnerName = 'Stranger';
    chatTitle.innerText = currentMode === 'video' ? "Random Video" : "Random Chat";
    const videoNameSpan = document.getElementById('video-partner-name');
    if (videoNameSpan) videoNameSpan.innerText = 'Stranger';
    
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) startOverlay.classList.remove('hidden');
}

function nextPartner() {
    randomBox.innerHTML = '';
    showTyping(false);
    endCall();
    isSearching = true;
    randomPartnerName = 'Stranger';
    chatTitle.innerText = currentMode === 'video' ? "Random Video" : "Random Chat";
    const videoNameSpan = document.getElementById('video-partner-name');
    if (videoNameSpan) videoNameSpan.innerText = 'Stranger';
    conn.send(JSON.stringify({ action: 'next' }));
}

function sendMessage(context, msgType = 'text', overrideMsg = null) {
    const input = (context === 'random' || context === 'video') ? randomInput : (context === 'public' ? publicInput : groupInput);
    const msg = input.value.trim();
    if (!msg && !overrideMsg) return;

    if (!overrideMsg) {
        input.value = '';
    }

    let payloadMsg = overrideMsg || msg;

    // AES Encryption for Random, Video and Custom Rooms
    if ((context === 'random' || context === 'video') && currentAesKey) {
        payloadMsg = encryptMsg(payloadMsg, currentAesKey);
    } else if (context === 'group' && rawCustomRoomCode) {
        payloadMsg = encryptMsg(payloadMsg, rawCustomRoomCode);
    }

    logMessage((context === 'random' || context === 'video') ? randomBox : (context === 'public' ? publicBox : groupBox), 'you', 'You', (overrideMsg || msg), msgType);
    conn.send(JSON.stringify({ action: 'message', content: payloadMsg, context: context, type: msgType }));

    if (msgType === 'text') { input.focus(); }
}
function handleInput(e, ctx) { 
    if (e.key === 'Enter') {
        sendMessage(ctx); 
    } else {
        sendTypingSignal(ctx);
    }
}
function insertEmoji(e, ctx) {
    const el = (ctx === 'random' || ctx === 'video') ? randomInput : (ctx === 'public' ? publicInput : groupInput);
    el.value += e; el.focus();
}

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
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                // Send base64 directly via WebSocket (Zero Storage Architecture)
                sendMessage(currentMode, 'image', dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        input.value = '';
    }
}

let typingTimer = {};
let lastTypingTime = {};

function sendTypingSignal(ctx = 'random') {
    const now = Date.now();
    if (!lastTypingTime[ctx]) lastTypingTime[ctx] = 0;
    if (now - lastTypingTime[ctx] > 2000 && conn && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify({ action: 'typing', context: ctx }));
        lastTypingTime[ctx] = now;
    }
}

function showTyping(show, context = 'random', name = 'Stranger') {
    const displayContext = (context === 'random' || context === 'video') ? 'random' : context;
    const box = displayContext === 'random' ? randomBox : (displayContext === 'public' ? publicBox : groupBox);
    if (!box) return;

    const typingId = 'typing-' + displayContext;
    let ind = document.getElementById(typingId);
    
    if (show) {
        if (!ind) {
            ind = document.createElement('div');
            ind.id = typingId;
            ind.className = 'flex items-center gap-2 my-2 msg-anim text-xs italic opacity-80';
            box.appendChild(ind);
        }
        ind.innerHTML = `
            <div class="flex space-x-1.5 items-center px-4 py-2 bg-base-200/40 rounded-full border border-base-content/5">
                <span class="font-semibold mr-1 text-base-content">${name} is typing</span>
                <span class="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
                <span class="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
            </div>
        `;
        box.scrollTop = box.scrollHeight;
        
        if (typingTimer[displayContext]) clearTimeout(typingTimer[displayContext]);
        typingTimer[displayContext] = setTimeout(() => {
            if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
        }, 3000);
    } else {
        if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
    }
}

// --- VIDEO CALLS & RESIZABLE LOGIC ---

// Draggable & Resizable Logic
function makeElementDraggable(elm) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let startX = 0, startY = 0; // For detecting "Tap" vs "Drag"

    // Touch Support
    elm.ontouchstart = dragTouchStart;
    elm.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        startX = e.clientX;
        startY = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        updatePosition(elm.offsetTop - pos2, elm.offsetLeft - pos1);
    }

    function dragTouchStart(e) {
        // Don't prevent default immediately if you want other interactions, but here we usually do
        // e.preventDefault(); 
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        startX = touch.clientX;
        startY = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDragTouch;
    }

    function elementDragTouch(e) {
        // e.preventDefault(); // Prevent scrolling while dragging
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        updatePosition(elm.offsetTop - pos2, elm.offsetLeft - pos1);
    }

    function updatePosition(top, left) {
        const parent = elm.parentElement;
        const maxTop = parent.clientHeight - elm.clientHeight;
        const maxLeft = parent.clientWidth - elm.clientWidth;

        // Boundary Check
        let newTop = Math.max(0, Math.min(top, maxTop));
        let newLeft = Math.max(0, Math.min(left, maxLeft));

        elm.style.top = newTop + "px";
        elm.style.left = newLeft + "px";
        elm.style.right = 'auto'; // Disable CSS right positioning once dragged
    }

    function closeDragElement(e) {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;

        // Calculate distance moved to distinguish Tap vs Drag
        let endX = e.clientX || (e.changedTouches ? e.changedTouches[0].clientX : 0);
        let endY = e.clientY || (e.changedTouches ? e.changedTouches[0].clientY : 0);

        const dist = Math.hypot(endX - startX, endY - startY);

        // If moved less than 5 pixels, treat as a TAP
        if (dist < 5) {
            toggleLocalVideoSize();
        }
    }
}

function toggleLocalVideoSize() {
    const elm = document.getElementById('local-wrapper');
    localVideoSizeState = (localVideoSizeState + 1) % 3;

    if (localVideoSizeState === 0) {
        // Default
        elm.style.width = '30%';
    } else if (localVideoSizeState === 1) {
        // Bigger
        elm.style.width = '50%';
    } else if (localVideoSizeState === 2) {
        // Smaller
        elm.style.width = '15%';
    }
}

// Initialize Draggable
makeElementDraggable(document.getElementById("local-wrapper"));

function toggleMic() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            isMuted = !isMuted;
            audioTracks.forEach(track => track.enabled = !isMuted);
            const btn = document.getElementById('btn-mic');
            if (isMuted) {
                btn.classList.add('bg-red-500', 'hover:bg-red-600');
                btn.classList.remove('bg-black/50');
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12.732a1 1 0 01-1.707.707l-3.515-3.515H3a1 1 0 01-1-1v-4a1 1 0 011-1h1.778l3.515-3.515a1 1 0 011.09-.231zM12.71 6.29a1 1 0 01.037 1.414l-1.414 1.414 1.414 1.414a1 1 0 01-1.414 1.414l-1.414-1.414-1.414 1.414a1 1 0 111.414-1.414l1.414 1.414 1.414-1.414a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            } else {
                btn.classList.remove('bg-red-500', 'hover:bg-red-600');
                btn.classList.add('bg-black/50');
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" /></svg>`;
            }
        }
    }
}

function toggleCam() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            isCameraOff = !isCameraOff;
            videoTracks.forEach(track => track.enabled = !isCameraOff);
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
}


async function startCall(isVoiceOnly = false) {
    showVideoTip();
    btnCall.classList.add('hidden');
    if (btnVoiceCall) btnVoiceCall.classList.add('hidden');
    btnHangup.classList.remove('hidden');

    const constraints = {
        video: isVoiceOnly ? false : { facingMode: "user" },
        audio: true
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Sync toggled state
        if (isMuted) localStream.getAudioTracks().forEach(t => t.enabled = false);
        if (!isVoiceOnly && isCameraOff) localStream.getVideoTracks().forEach(t => t.enabled = false);

        localVideo.srcObject = isVoiceOnly ? null : localStream;

        videoContainer.style.display = 'block';
        videoContainer.classList.remove('hidden');

        // Toggle voice placeholder visibility
        const voicePlaceholder = document.getElementById('voice-placeholder');
        if (isVoiceOnly) {
            if (voicePlaceholder) voicePlaceholder.classList.remove('hidden');
            localVideo.classList.add('hidden');
            remoteVideo.classList.add('hidden');
        } else {
            if (voicePlaceholder) voicePlaceholder.classList.add('hidden');
            localVideo.classList.remove('hidden');
            remoteVideo.classList.remove('hidden');
        }

        createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        conn.send(JSON.stringify({ action: 'call_signal', data: { type: 'offer', sdp: offer, isVoiceOnly: isVoiceOnly } }));
        logSystem(randomBox, isVoiceOnly ? "📞 Calling stranger (Voice)..." : "🎥 Calling stranger...");
    } catch (err) {
        console.error(err);
        alert("Camera/Microphone access required!"); endCall();
    }
}

async function handleSignalMessage(signal) {
    if (!peerConnection) createPeerConnection();

    if (signal.type === 'offer') {
        const isVoiceOnly = signal.isVoiceOnly || false;
        window.pendingOffer = signal.sdp;
        window.pendingVoiceOnly = isVoiceOnly;

        if (currentMode === 'video' || currentMode === 'voice') {
            acceptCall();
        } else {
            incomingOverlay.classList.remove('hidden');
        }
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
    if (btnVoiceCall) btnVoiceCall.classList.add('hidden');
    btnHangup.classList.remove('hidden');

    videoContainer.style.display = 'block';
    videoContainer.classList.remove('hidden');

    const isVoiceOnly = window.pendingVoiceOnly || false;
    const constraints = {
        video: isVoiceOnly ? false : { facingMode: "user" },
        audio: true
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Sync toggled state
        if (isMuted) localStream.getAudioTracks().forEach(t => t.enabled = false);
        if (!isVoiceOnly && isCameraOff) localStream.getVideoTracks().forEach(t => t.enabled = false);

        localVideo.srcObject = isVoiceOnly ? null : localStream;

        const voicePlaceholder = document.getElementById('voice-placeholder');
        if (isVoiceOnly) {
            if (voicePlaceholder) voicePlaceholder.classList.remove('hidden');
            localVideo.classList.add('hidden');
            remoteVideo.classList.add('hidden');
        } else {
            if (voicePlaceholder) voicePlaceholder.classList.add('hidden');
            localVideo.classList.remove('hidden');
            remoteVideo.classList.remove('hidden');
        }

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
    window.pendingVoiceOnly = false;

    remoteVideo.srcObject = null;
    localVideo.srcObject = null;

    const voicePlaceholder = document.getElementById('voice-placeholder');
    if (voicePlaceholder) voicePlaceholder.classList.add('hidden');
    localVideo.classList.remove('hidden');
    remoteVideo.classList.remove('hidden');

    videoContainer.style.display = 'none';
    videoContainer.classList.add('hidden');

    btnCall.classList.remove('hidden');
    if (btnVoiceCall) btnVoiceCall.classList.remove('hidden');
    btnHangup.classList.add('hidden');
    incomingOverlay.classList.add('hidden');

    isMuted = false;
    isCameraOff = false;

    // Reset local video position/size
    const elm = document.getElementById('local-wrapper');
    elm.style.top = '';
    elm.style.left = '';
    elm.style.right = '1rem'; // Reset to CSS default
    elm.style.width = '30%';
    localVideoSizeState = 0;
}


function fetchFlag() {
    fetch('https://ipwho.is/')
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                myFlag = data.country_flag || getFlagEmoji(data.country_code);
                if (conn && conn.readyState === WebSocket.OPEN) {
                    conn.send(JSON.stringify({ action: 'set_profile', flag: myFlag }));
                }
            }
        })
        .catch(err => {
            console.log("Failed to fetch flag:", err);
        });
}

function getFlagEmoji(countryCode) {
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

document.addEventListener('DOMContentLoaded', () => {
    // Always use dark mode
    document.documentElement.setAttribute('data-theme', 'night');
    localStorage.removeItem('theme');

    // Fetch user country flag
    fetchFlag();

    // Restore Gender Preferences
    const savedUserGender = localStorage.getItem('user_gender');
    const savedTargetGender = localStorage.getItem('target_gender');
    if (savedUserGender) {
        const userGenderSelect = document.getElementById('user-gender');
        if (userGenderSelect) userGenderSelect.value = savedUserGender;
    }
    if (savedTargetGender) {
        const targetGenderSelect = document.getElementById('target-gender');
        if (targetGenderSelect) targetGenderSelect.value = savedTargetGender;
    }

    const modal = document.getElementById('agreement_modal');
    if (!sessionStorage.getItem('terms_accepted')) {
        modal.showModal();
        modal.addEventListener('cancel', (event) => {
            event.preventDefault();
        });
    }
});

function acceptTerms() {
    sessionStorage.setItem('terms_accepted', 'true');
    document.getElementById('agreement_modal').close();
    console.log("Terms accepted.");
}

function showVideoTip() {
    if (!sessionStorage.getItem('video_tip_shown')) {
        document.getElementById('video_tip_modal').showModal();
        sessionStorage.setItem('video_tip_shown', 'true');
    }
}

function checkIOSInstall() {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !isStandalone) {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-4 left-4 right-4 bg-base-100 p-4 rounded-xl border border-base-content/10 shadow-2xl z-50 flex flex-col gap-2 msg-anim";
        toast.innerHTML = `
          <div class="flex justify-between items-start">
              <div>
                  <h3 class="font-bold text-sm">Install XOXO App 📲</h3>
                  <p class="text-xs opacity-70 mt-1">For the best experience, add this to your home screen.</p>
              </div>
              <button onclick="this.parentElement.parentElement.remove()" class="btn btn-xs btn-circle btn-ghost">✕</button>
          </div>
      `;
        document.body.appendChild(toast);
    }
}
setTimeout(checkIOSInstall, 2000);

initSocket();

// --- GROUP CHAT FUNCTIONS ---
function joinCustomRoom() {
    const code = document.getElementById('room-code-input').value.trim();
    if (!code) {
        alert("Please enter a room code!");
        return;
    }
    if (conn.readyState !== WebSocket.OPEN) return;
    
    // Store raw code for encryption and send hashed code to server
    rawCustomRoomCode = code;
    const hashedCode = CryptoJS.SHA256(code).toString();
    
    // Reset UI state
    groupBox.innerHTML = '';
    
    conn.send(JSON.stringify({ action: 'join_group', group_id: hashedCode }));
}

function joinGroup(groupId) {
    if (conn.readyState !== WebSocket.OPEN) return;
    groupBox.innerHTML = '';
    rawCustomRoomCode = groupId;
    const hashedCode = CryptoJS.SHA256(groupId).toString();
    conn.send(JSON.stringify({ action: 'join_group', group_id: hashedCode }));
}

function encryptMsg(msg, key) {
    if (!key) return msg;
    try {
        return CryptoJS.AES.encrypt(msg, key).toString();
    } catch(e) { return msg; }
}

function decryptMsg(msg, key) {
    if (!key) return msg;
    try {
        const bytes = CryptoJS.AES.decrypt(msg, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || msg;
    } catch (e) {
        return msg;
    }
}

function setGroupUI(state, groupId = null) {
    const setup = document.getElementById('group-idle');
    const active = document.getElementById('group-active');
    const linkDisplay = document.getElementById('group-invite-link');

    if (state === 'active') {
        setup.classList.add('hidden');
        active.classList.remove('hidden');
        if (groupId) {
            const link = `${window.location.origin}${window.location.pathname}?group=${groupId}`;
            linkDisplay.innerText = link;
        }
    } else {
        setup.classList.remove('hidden');
        active.classList.add('hidden');
    }
}

function copyInviteLink() {
    const text = document.getElementById('group-invite-link').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert("Link copied to clipboard!");
    });
}

function leaveCustomRoom() {
    if (conn && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify({ action: 'leave_group' }));
    }
    currentGroupId = null;
    rawCustomRoomCode = null;
    setGroupUI('idle');
    const url = new URL(window.location);
    url.searchParams.delete('group');
    window.history.pushState({}, '', url);
}

// Check for group param on load
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('group');
    if (groupId) {
        // Wait for connection then join
        const checkConn = setInterval(() => {
            if (conn && conn.readyState === WebSocket.OPEN) {
                switchMode('group');
                joinGroup(groupId);
                clearInterval(checkConn);
            }
        }, 500);
    }
});

// --- MOBILE KEYBOARD RESIZE HANDLER (VISUAL VIEWPORT) ---
function updateAppHeight() {
    if (window.visualViewport) {
        const height = window.visualViewport.height;
        document.documentElement.style.setProperty('--app-height', `${height}px`);
        setTimeout(() => {
            const activeBox = (currentMode === 'random' || currentMode === 'video' || currentMode === 'voice') ? randomBox : (currentMode === 'group' ? groupBox : publicBox);
            if (activeBox) {
                activeBox.scrollTop = activeBox.scrollHeight;
            }
        }, 100);
    }
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeight);
    window.visualViewport.addEventListener('scroll', updateAppHeight);
}
window.addEventListener('load', updateAppHeight);