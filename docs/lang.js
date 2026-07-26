const LANG = {
    en: {
        // Sidebar
        nav_random: "Meet Random",
        nav_random_desc: "Text, Video, or Voice",
        nav_public: "Public Lounge",
        nav_public_desc: "Global public lobby",
        nav_group: "Private Room",
        nav_group_desc: "Private group code",
        // Footer
        users_online: "Users online:",
        privacy_policy: "Privacy Policy",
        terms_service: "Terms of Service",
        dark_mode: "Dark Mode",
        lang_label: "Bahasa",
        // Incoming call
        incoming_video_call: "Incoming Video Call",
        stranger_connect_video: "Stranger wants to connect video with you",
        // Voice placeholder
        voice_call_connected: "Voice Call Connected",
        talking_with: "Talking with stranger...",
        // Start overlay
        stranger_matchmaking: "Stranger Matchmaking",
        stranger_matchmaking_desc: "Match randomly, type secretly, or share video calls with stranger completely anonymously.",
        match_mode: "Match Mode",
        text_media: "Text & Media",
        video_call: "Video Call",
        voice_call: "Voice Call",
        my_gender: "My Gender",
        match_gender: "Match Gender",
        start_searching: "Start Searching",
        // Group room
        room_code: "Room Code",
        join_create_room: "Join / Create Room",
        invite_link: "Invite Link",
        copy_link: "Copy Link",
        leave_room: "Leave",
        group_connected: "Group Room Connected",
        // Confirm dialog
        confirm_switch_mode: "Are you sure you want to switch mode? This will disconnect your chat or cancel your active search.",
        // View once
        media_opened: "Media opened (View Once)",
        // System messages
        connected_with: "You are connected with",
        stranger_disconnected: "Stranger disconnected.",
        looking_for: "Looking for a stranger...",
        search_canceled: "Search canceled.",
        left_group: "left the group.",
        // Public
        public_connected: "Public Lounge Connected",
        next: "Next",
        cancel_search: "Cancel Search",
        // Video/Voice mode
        video_matchmaking: "Video Matchmaking",
        video_matchmaking_desc: "Match and start high-quality video call instantly and anonymously with strangers.",
        voice_matchmaking: "Voice Matchmaking",
        voice_matchmaking_desc: "Match and start voice calls instantly and anonymously with strangers.",
        // Chat
        connected_to: "Connected to XOXO Chat",
    },
    id: {
        // Sidebar
        nav_random: "Random Chat",
        nav_random_desc: "Teks, Video, atau Suara",
        nav_public: "Ruang Publik",
        nav_public_desc: "Lobi publik global",
        nav_group: "Ruang Pribadi",
        nav_group_desc: "Kode grup privat",
        // Footer
        users_online: "Pengguna online:",
        privacy_policy: "Kebijakan Privasi",
        terms_service: "Syarat Layanan",
        dark_mode: "Mode Gelap",
        lang_label: "Language",
        // Incoming call
        incoming_video_call: "Panggilan Video Masuk",
        stranger_connect_video: "Stranger ingin terhubung video dengan kamu",
        // Voice placeholder
        voice_call_connected: "Panggilan Suara Terhubung",
        talking_with: "Berbicara dengan stranger...",
        // Start overlay
        stranger_matchmaking: "Cari Stranger",
        stranger_matchmaking_desc: "Cocokkan secara acak, kirim pesan rahasia, atau lakukan panggilan video dengan stranger secara anonim.",
        match_mode: "Mode Cocok",
        text_media: "Teks & Media",
        video_call: "Panggilan Video",
        voice_call: "Panggilan Suara",
        my_gender: "Jenis Kelamin Saya",
        match_gender: "Jenis Kelamin Target",
        start_searching: "Mulai Cari",
        // Group room
        room_code: "Kode Ruangan",
        join_create_room: "Gabung / Buat Ruangan",
        invite_link: "Tautan Undangan",
        copy_link: "Salin Tautan",
        leave_room: "Keluar",
        group_connected: "Ruang Grup Terhubung",
        // Confirm dialog
        confirm_switch_mode: "Yakin ingin ganti mode? Ini akan memutuskan chat atau membatalkan pencarian aktif.",
        // View once
        media_opened: "Media dibuka (Pesan Sekali Lihat)",
        // System messages
        connected_with: "Kamu terhubung dengan",
        stranger_disconnected: "Stranger terputus.",
        looking_for: "Mencari stranger...",
        search_canceled: "Pencarian dibatalkan.",
        left_group: "keluar dari grup.",
        // Public
        public_connected: "Ruang Publik Terhubung",
        next: "Selanjutnya",
        cancel_search: "Batalkan Pencarian",
        // Video/Voice mode
        video_matchmaking: "Cocok Video",
        video_matchmaking_desc: "Cocokkan dan mulai panggilan video berkualitas tinggi secara instan dan anonim dengan stranger.",
        voice_matchmaking: "Cocok Suara",
        voice_matchmaking_desc: "Cocokkan dan mulai panggilan suara secara instan dan anonim dengan stranger.",
        // Chat
        connected_to: "Terhubung ke XOXO Chat",
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
    return (LANG[currentLang] && LANG[currentLang][key]) || (LANG.en[key]) || key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (translated) el.textContent = translated;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated) el.placeholder = translated;
    });
    // Update toggle label
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) langToggle.checked = (currentLang === 'id');
}

function switchLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
}
