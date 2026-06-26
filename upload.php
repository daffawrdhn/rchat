<?php
header('Content-Type: application/json');

// 1. Validasi Metode
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Invalid method']);
    exit;
}

// 2. Batasi Ukuran Payload (Max ~5MB) untuk mencegah DoS
$maxSize = 5 * 1024 * 1024;
if (isset($_SERVER['CONTENT_LENGTH']) && $_SERVER['CONTENT_LENGTH'] > $maxSize) {
    http_response_code(413);
    echo json_encode(['error' => 'Payload too large. Max 5MB.']);
    exit;
}

$payload = file_get_contents('php://input');
if (strlen($payload) > $maxSize) {
    http_response_code(413);
    echo json_encode(['error' => 'Payload too large. Max 5MB.']);
    exit;
}

$data = json_decode($payload, true);
if (!$data || !isset($data['type']) || !isset($data['data'])) {
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$type = $data['type']; // 'image' or 'audio'
$base64Data = $data['data'];

// 3. Whitelist Ekstensi yang Aman
$allowedImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$allowedAudioExts = ['webm', 'mp3', 'ogg', 'wav'];

$ext = '';
if ($type === 'image' && preg_match('/^data:image\/([a-zA-Z0-9]+);base64,/', $base64Data, $matches)) {
    $ext = strtolower($matches[1]);
    $ext = $ext === 'jpeg' ? 'jpg' : $ext;
    if (!in_array($ext, $allowedImageExts)) {
        echo json_encode(['error' => 'Unsupported image format']);
        exit;
    }
    $base64Data = preg_replace('/^data:image\/([a-zA-Z0-9]+);base64,/', '', $base64Data);
} elseif ($type === 'audio' && preg_match('/^data:audio\/([a-zA-Z0-9]+);base64,/', $base64Data, $matches)) {
    $ext = strtolower($matches[1]);
    if (!in_array($ext, $allowedAudioExts)) {
        echo json_encode(['error' => 'Unsupported audio format']);
        exit;
    }
    $base64Data = preg_replace('/^data:audio\/([a-zA-Z0-9]+);base64,/', '', $base64Data);
} else {
    echo json_encode(['error' => 'Invalid data format']);
    exit;
}

$base64Data = str_replace(' ', '+', $base64Data);
$binaryData = base64_decode($base64Data);

if ($binaryData === false) {
    echo json_encode(['error' => 'Failed to decode base64']);
    exit;
}

// 4. Verifikasi MIME type dari binary (Mencegah fake extension)
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->buffer($binaryData);
if ($type === 'image' && strpos($mime, 'image/') !== 0) {
    echo json_encode(['error' => 'Invalid image content']);
    exit;
} elseif ($type === 'audio' && strpos($mime, 'audio/') !== 0 && strpos($mime, 'video/') !== 0) {
    // Note: WebM audio is sometimes detected as video/webm by finfo
    echo json_encode(['error' => 'Invalid audio content']);
    exit;
}

$uploadsDir = __DIR__ . '/uploads';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

// Clean old files (older than 1 hour)
$files = glob($uploadsDir . '/*');
$now = time();
foreach ($files as $file) {
    if (is_file($file) && ($now - filemtime($file) >= 3600)) {
        unlink($file);
    }
}

// 5. Penamaan file acak & aman
$filename = uniqid($type . '_') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$filepath = $uploadsDir . '/' . $filename;

if (file_put_contents($filepath, $binaryData)) {
    echo json_encode(['url' => 'uploads/' . $filename]);
} else {
    echo json_encode(['error' => 'Failed to save file']);
}
