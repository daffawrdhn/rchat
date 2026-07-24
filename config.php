<?php
// Load environment variables from .env if it exists
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
        // Strip quotes
        if (preg_match('/^"(.*)"$/', $value, $matches)) {
            $value = $matches[1];
        } elseif (preg_match('/^\'(.*)\'$/', $value, $matches)) {
            $value = $matches[1];
        }
        
        putenv(sprintf('%s=%s', $name, $value));
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

// Configuration registry
return [
    'ws_port' => (int)(getenv('WS_PORT') ?: 8080),
    'ws_allowed_origins' => explode(',', getenv('WS_ALLOWED_ORIGINS') ?: 'chat.1year.site,localhost,127.0.0.1'),
    'redis_host' => getenv('REDIS_HOST') ?: '127.0.0.1',
    'redis_port' => (int)(getenv('REDIS_PORT') ?: 6379),
    'ip_connection_limit' => (int)(getenv('IP_CONNECTION_LIMIT') ?: 5),
    'anti_spam_cooldown' => (float)(getenv('ANTI_SPAM_COOLDOWN') ?: 0.5),
    'ws_public_url' => getenv('WS_PUBLIC_URL') ?: 'wss://chat.1year.site/ws',
];
