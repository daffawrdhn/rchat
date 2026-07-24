<?php
// Load environment variables from .env if it exists
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name  = trim($name);
        $value = trim($value);

        // Strip surrounding quotes
        if (preg_match('/^"(.*)"$/', $value, $m)) $value = $m[1];
        elseif (preg_match("/^'(.*)'$/", $value, $m)) $value = $m[1];

        putenv("{$name}={$value}");
        $_ENV[$name]    = $value;
        $_SERVER[$name] = $value;
    }
}

// Configuration registry
return [
    // App Identity
    'app_name'                => getenv('APP_NAME')    ?: 'XOXO Chat',
    'app_tagline'             => getenv('APP_TAGLINE') ?: 'Chat with Stranger Anonymously',
    'app_url'                 => getenv('APP_URL')     ?: 'https://chat.1year.site',
    'app_env'                 => getenv('APP_ENV')     ?: 'production',

    // WebSocket Server
    'ws_port'                 => (int)(getenv('WS_PORT')        ?: 8080),
    'ws_public_url'           => getenv('WS_PUBLIC_URL')        ?: 'wss://chat.1year.site/ws',
    'ws_allowed_origins'      => explode(',', getenv('WS_ALLOWED_ORIGINS') ?: 'chat.1year.site,localhost,127.0.0.1'),

    // Bot Prevention & Safety
    'ip_connection_limit'     => (int)(getenv('IP_CONNECTION_LIMIT')   ?: 5),
    'anti_spam_cooldown'      => (float)(getenv('ANTI_SPAM_COOLDOWN')  ?: 0.5),
    'spam_warn_threshold'     => (int)(getenv('SPAM_WARN_THRESHOLD')   ?: 3),

    // Group Room Settings
    'group_inactivity_timeout' => (int)(getenv('GROUP_INACTIVITY_TIMEOUT') ?: 300),
];
