<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class Chat implements MessageComponentInterface
{
    protected $clients;
    protected $waitingClient;
    protected $pairs;

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        $this->waitingClient = null;
        $this->pairs = [];
    }

    public function onOpen(ConnectionInterface $conn)
    {
        // Initialize Anti-Spam & User Data
        $conn->nickname = $this->generateNickname();
        $conn->lastMsgTime = 0;
        $conn->spamWarnings = 0;

        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId}) - {$conn->nickname}\n";

        $conn->send(json_encode([
            'status' => 'identity',
            'nickname' => $conn->nickname
        ]));

        $this->broadcastUserCount();
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $data = json_decode($msg, true);
        if (!isset($data['action']))
            return;

        // --- ANTI SPAM CHECK ---
        if ($data['action'] === 'message') {
            $currentTime = microtime(true);
            $timeDiff = $currentTime - $from->lastMsgTime;

            // Limit: 1 message every 0.5 seconds
            if ($timeDiff < 0.5) {
                $from->spamWarnings++;
                if ($from->spamWarnings > 3) {
                    $from->send(json_encode(['status' => 'system', 'msg' => 'You are typing too fast! Slow down.']));
                }
                return;
            }

            $from->lastMsgTime = $currentTime;
            $from->spamWarnings = 0; // Reset warnings on successful message
        }
        // -----------------------

        switch ($data['action']) {
            case 'join_room':
                $from->send(json_encode(['status' => 'room_joined', 'room' => $data['room']]));
                break;

            case 'find_partner':
                $this->handleFindPartner($from);
                break;

            case 'message':
                $context = $data['context'] ?? 'public';
                $type = $data['type'] ?? 'text'; // 'text' or 'image'
                $content = $data['content'] ?? '';

                if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
                    $this->handlePrivateMessage($from, $content, $type);
                } else {
                    $this->handlePublicMessage($from, $content, $type);
                }
                break;

            case 'call_signal':
                if (isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode([
                        'status' => 'call_signal',
                        'signal' => $data['data']
                    ]));
                }
                break;

            case 'typing':
                $this->handleTyping($from);
                break;

            case 'next':
                $this->handleNext($from);
                break;
        }
    }

    private function handlePublicMessage($from, $msg, $type)
    {
        // Basic validation for image size server-side (optional, but good practice)
        if ($type === 'image' && strlen($msg) > 150000) { // Limit ~150kb raw string
            return;
        }

        $payload = json_encode([
            'status' => 'public_msg',
            'name' => $from->nickname,
            'msg' => $msg,
            'type' => $type,
            'is_me' => false
        ]);

        foreach ($this->clients as $client) {
            if ($client !== $from) {
                $client->send($payload);
            }
        }
    }

    private function handlePrivateMessage($from, $msg, $type)
    {
        if (isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode([
                'status' => 'message',
                'msg' => $msg,
                'type' => $type
            ]));
        }
    }

    private function handleFindPartner($conn)
    {
        if (isset($this->pairs[$conn->resourceId]) || $this->waitingClient === $conn) {
            return;
        }

        if ($this->waitingClient !== null && $this->waitingClient !== $conn) {
            $partner = $this->waitingClient;

            $this->pairs[$conn->resourceId] = $partner;
            $this->pairs[$partner->resourceId] = $conn;
            $this->waitingClient = null;

            $conn->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found! Say hello.']));
            $partner->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found! Say hello.']));
        } else {
            $this->waitingClient = $conn;
            $conn->send(json_encode(['status' => 'waiting', 'msg' => 'Looking for a stranger...']));
        }
    }

    private function handleTyping($from)
    {
        if (isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'typing']));
        }
    }

    private function handleNext($conn)
    {
        $this->cleanupRandomChat($conn);
        $this->handleFindPartner($conn);
    }

    private function cleanupRandomChat($conn)
    {
        if (isset($this->pairs[$conn->resourceId])) {
            $partner = $this->pairs[$conn->resourceId];
            unset($this->pairs[$conn->resourceId]);
            unset($this->pairs[$partner->resourceId]);

            $partner->send(json_encode(['status' => 'disconnected', 'msg' => 'Stranger disconnected.']));
        }

        if ($this->waitingClient === $conn) {
            $this->waitingClient = null;
        }
    }

    private function generateNickname()
    {
        $adjs = ['Cool', 'Super', 'Lazy', 'Hyper', 'Happy', 'Sad', 'Wild', 'Neon', 'Dark', 'Fast'];
        $nouns = ['Panda', 'Tiger', 'Fox', 'Wolf', 'Cat', 'Dog', 'Bear', 'Eagle', 'Shark', 'Hawk'];
        return $adjs[array_rand($adjs)] . $nouns[array_rand($nouns)] . rand(100, 999);
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->cleanupRandomChat($conn);
        $this->clients->detach($conn);
        echo "Connection {$conn->resourceId} has disconnected\n";
        $this->broadcastUserCount();
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }

    private function broadcastUserCount()
    {
        $count = count($this->clients);
        $data = json_encode(['status' => 'stats', 'count' => $count]);
        foreach ($this->clients as $client) {
            $client->send($data);
        }
    }
}