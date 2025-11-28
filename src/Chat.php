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
        // Initialize Anti-Spam Timer
        $conn->lastMsgTime = 0;

        $conn->nickname = $this->generateNickname();
        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId})\n";

        $conn->send(json_encode([
            'status' => 'identity',
            'nickname' => $conn->nickname
        ]));

        $this->broadcastUserCount();
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        // --- ANTI SPAM CHECK (0.5s Delay) ---
        $currentTime = microtime(true);
        if (($currentTime - $from->lastMsgTime) < 0.5) {
            $from->send(json_encode(['status' => 'system', 'msg' => '⚠️ You are typing too fast!']));
            return;
        }
        $from->lastMsgTime = $currentTime;
        // ------------------------------------

        $data = json_decode($msg, true);
        if (!isset($data['action']))
            return;

        switch ($data['action']) {
            case 'join_room':
                $from->send(json_encode(['status' => 'room_joined', 'room' => $data['room']]));
                break;

            case 'find_partner':
                $this->handleFindPartner($from);
                break;

            case 'message':
                $context = $data['context'] ?? 'public';
                if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
                    $this->handlePrivateMessage($from, $data['content'] ?? '');
                } else {
                    $this->handlePublicMessage($from, $data['content'] ?? '');
                }
                break;

            case 'call_signal':
                // Forward WebRTC signals (Video/Audio)
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

    private function handlePublicMessage($from, $msg)
    {
        $payload = json_encode([
            'status' => 'public_msg',
            'name' => $from->nickname,
            'msg' => $msg,
            'is_me' => false
        ]);

        foreach ($this->clients as $client) {
            if ($client !== $from) {
                $client->send($payload);
            }
        }
    }

    private function handleFindPartner($conn)
    {
        if (isset($this->pairs[$conn->resourceId]) || $this->waitingClient === $conn) {
            return;
        }

        if ($this->waitingClient !== null && $this->waitingClient !== $conn) {
            $partner = $this->waitingClient;

            // Validate if partner is still connected
            if (!$this->clients->contains($partner)) {
                $this->waitingClient = null;
                $this->handleFindPartner($conn); // Retry
                return;
            }

            $this->pairs[$conn->resourceId] = $partner;
            $this->pairs[$partner->resourceId] = $conn;
            $this->waitingClient = null;

            $conn->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found!']));
            $partner->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found!']));
        } else {
            $this->waitingClient = $conn;
            $conn->send(json_encode(['status' => 'waiting', 'msg' => 'Looking for a stranger...']));
        }
    }

    private function handlePrivateMessage($from, $msg)
    {
        if (isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'message', 'msg' => $msg]));
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
        echo "Connection {$conn->resourceId} disconnected\n";
        $this->broadcastUserCount();
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
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