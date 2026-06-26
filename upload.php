<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Invalid method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['type']) || !isset($data['data'])) {
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$type = $data['type']; // 'image' or 'audio'
$base64Data = $data['data'];

$uploadsDir = __DIR__ . '/uploads';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

// Clean old files (older than 1 hour) to save space
$files = glob($uploadsDir . '/*');
$now = time();
foreach ($files as $file) {
    if (is_file($file)) {
        if ($now - filemtime($file) >= 3600) {
            unlink($file);
        }
    }
}

$ext = 'bin';
if ($type === 'image' && preg_match('/^data:image\/(.*?);base64,/', $base64Data, $matches)) {
    $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
    $base64Data = preg_replace('/^data:image\/(.*?);base64,/', '', $base64Data);
} elseif ($type === 'audio' && preg_match('/^data:audio\/(.*?);base64,/', $base64Data, $matches)) {
    $ext = $matches[1] === 'webm' ? 'webm' : $matches[1];
    $base64Data = preg_replace('/^data:audio\/(.*?);base64,/', '', $base64Data);
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

$filename = uniqid($type . '_') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$filepath = $uploadsDir . '/' . $filename;

if (file_put_contents($filepath, $binaryData)) {
    echo json_encode(['url' => 'uploads/' . $filename]);
} else {
    echo json_encode(['error' => 'Failed to save file']);
}
