<?php
error_reporting(E_ALL ^ E_DEPRECATED);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/src/Chat.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use MyApp\Chat;

// Running on port 8080
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new Chat()
        )
    ),
    8080
);

echo "Server started on port 8080...\n";
echo "Features Active:\n";
echo "- Anti-Spam (0.5s limit)\n";
echo "- Video Call Support (Signaling)\n";
echo "- Compressed Image Support (Base64)\n";
echo "- Live User Counter\n";

$server->run();