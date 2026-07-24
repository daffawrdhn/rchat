<?php
error_reporting(E_ALL ^ E_DEPRECATED);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/src/Chat.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\Http\OriginCheck;
use MyApp\Chat;

$chat = new Chat();
$ws = new WsServer($chat);
$checkedApp = new OriginCheck($ws, ['chat.1year.site']);

// Running on port 8080
$server = IoServer::factory(
    new HttpServer(
        $checkedApp
    ),
    8080
);

// Timer for 5 minute inactivity cleanup
$server->loop->addPeriodicTimer(60, function () use ($chat) {
    $chat->cleanupInactiveGroups();
});

echo "Server started on port 8080...\n";
echo "Features Active:\n";
echo "- Anti-Spam (0.5s limit)\n";
echo "- IP Connection Limiting (Max 5 per IP)\n";
echo "- Video Call Support (Signaling)\n";
echo "- Compressed Image Support (Base64)\n";
echo "- Live User Counter\n";

$server->run();