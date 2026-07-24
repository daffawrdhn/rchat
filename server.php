<?php
error_reporting(E_ALL ^ E_DEPRECATED);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/src/Chat.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use MyApp\Chat;
use MyApp\SafeOriginCheck;

$config = require __DIR__ . '/config.php';

$chat = new Chat($config);
$ws = new WsServer($chat);
$checkedApp = new SafeOriginCheck($ws, $config['ws_allowed_origins']);

// Running on port from environment config
$server = IoServer::factory(
    new HttpServer(
        $checkedApp
    ),
    $config['ws_port']
);

// Timer for 5 minute inactivity cleanup
$server->loop->addPeriodicTimer(60, function () use ($chat) {
    $chat->cleanupInactiveGroups();
});

echo "{$config['app_name']} WebSocket Server [{$config['app_env']}]\n";
echo "Listening on port {$config['ws_port']}...\n";
echo "App URL: {$config['app_url']}\n";
echo "Features Active:\n";
echo "- Anti-Spam ({$config['anti_spam_cooldown']}s cooldown, warn after {$config['spam_warn_threshold']} violations)\n";
echo "- IP Connection Limiting (Max {$config['ip_connection_limit']} per IP)\n";
echo "- Group Inactivity Timeout ({$config['group_inactivity_timeout']}s)\n";
echo "- Video Call Support (Signaling)\n";
echo "- Compressed Image Support (Base64)\n";
echo "- Live User Counter\n";

$server->run();