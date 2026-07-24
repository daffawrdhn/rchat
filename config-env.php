<?php
header('Content-Type: application/javascript');
$config = require __DIR__ . '/config.php';
echo "window.XOXO_CONFIG = " . json_encode([
    'wsUrl' => $config['ws_public_url']
], JSON_UNESCAPED_SLASHES) . ";";
