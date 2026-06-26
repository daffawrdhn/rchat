<?php
require __DIR__ . '/vendor/autoload.php';

use Ratchet\Client\WebSocket;
use React\EventLoop\Loop;

$loop = Loop::get();
$testResults = [];

echo "Starting WebSocket Tests...\n";

\Ratchet\Client\connect('ws://127.0.0.1:8080/ws')->then(function(WebSocket $conn) use ($loop, &$testResults) {
    echo "✅ Connected to server!\n";
    $testResults['connected'] = true;
    
    // Join Public Room
    $conn->send(json_encode([
        'action' => 'join_room',
        'room' => 'public'
    ]));
    
    // Send a text message
    $conn->send(json_encode([
        'action' => 'message',
        'context' => 'public',
        'type' => 'text',
        'content' => 'Hello from Automated Test!'
    ]));

    $conn->on('message', function($msg) use ($conn, $loop, &$testResults) {
        $data = json_decode($msg, true);
        
        if (isset($data['status']) && $data['status'] === 'identity') {
            echo "✅ Received Identity: {$data['nickname']}\n";
            $testResults['identity'] = true;
        }
        
        // Due to the anti-spam limit, the message might be delayed or we might receive it back
        if (isset($data['status']) && $data['status'] === 'public_msg' && $data['msg'] === 'Hello from Automated Test!') {
            $testResults['message_received'] = true;
            echo "✅ Message broadcasted and received successfully!\n";
            $conn->close();
        }
    });

    $conn->on('close', function($code = null, $reason = null) use ($loop) {
        echo "Connection closed.\n";
        $loop->stop();
    });
}, function(\Exception $e) use ($loop) {
    echo "❌ Could not connect: {$e->getMessage()}\n";
    $loop->stop();
});

$loop->run();

if (!empty($testResults['message_received'])) {
    echo "\n🎉 ALL WEBSOCKET TESTS PASSED!\n";
    exit(0);
} else {
    echo "\n❌ TESTS FAILED!\n";
    exit(1);
}
