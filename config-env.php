<?php
header('Content-Type: application/javascript');
$config = require __DIR__ . '/config.php';

// Only expose values that are safe to send to the browser
echo "window.XOXO_CONFIG = " . json_encode([
    'appName'      => $config['app_name'],
    'appTagline'   => $config['app_tagline'],
    'appUrl'       => $config['app_url'],
    'wsUrl'        => $config['ws_public_url'],
], JSON_UNESCAPED_SLASHES) . ";";
