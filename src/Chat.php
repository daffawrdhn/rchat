<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class Chat implements MessageComponentInterface {
    protected $clients;
    protected $waitingClient; // For Random Chat
    protected $pairs;         // For Random Chat
    
    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->waitingClient = null;
        $this->pairs = [];
    }

    public function onOpen(ConnectionInterface $conn) {
        // Initialize default properties
        $conn->chatMode = 'menu'; // 'menu', 'random', or 'public'
        
        // --- CHANGE: Generate Nickname on Server ---
        $conn->nickname = $this->generateNickname();
        
        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId}) assigned name: {$conn->nickname}\n";
        
        // Send the generated identity back to the user
        $conn->send(json_encode([
            'status' => 'identity',
            'nickname' => $conn->nickname
        ]));

        $this->broadcastUserCount();
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!isset($data['action'])) return;

        switch ($data['action']) {
            // 'set_nickname' case removed (handled in onOpen now)

            case 'join_room':
                $this->handleJoinRoom($from, $data['room']);
                break;

            case 'find_partner':
                // Ensure they are in random mode
                $from->chatMode = 'random';
                $this->handleFindPartner($from);
                break;

            case 'message':
                if ($from->chatMode === 'random') {
                    $this->handlePrivateMessage($from, $data['content'] ?? '');
                } elseif ($from->chatMode === 'public') {
                    $this->handlePublicMessage($from, $data['content'] ?? '');
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

    private function handleJoinRoom($conn, $room) {
        // If leaving Random chat, clean up previous state
        if ($conn->chatMode === 'random') {
            $this->cleanupRandomChat($conn);
        }

        $conn->chatMode = $room;

        // Confirm join
        $conn->send(json_encode([
            'status' => 'room_joined', 
            'room' => $room,
            'msg' => $room === 'public' ? "Joined Public Chat" : "Joined Random Chat"
        ]));
    }

    private function handlePublicMessage($from, $msg) {
        $payload = json_encode([
            'status' => 'public_msg',
            'name' => $from->nickname,
            'msg' => $msg,
            'is_me' => false
        ]);

        foreach ($this->clients as $client) {
            // Only send to people in public room
            if (isset($client->chatMode) && $client->chatMode === 'public') {
                if ($client !== $from) {
                    $client->send($payload);
                }
            }
        }
    }

    private function handleFindPartner($conn) {
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

    private function handlePrivateMessage($from, $msg) {
        if (isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'message', 'msg' => $msg]));
        }
    }

    private function handleTyping($from) {
        if (isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'typing']));
        }
    }

    private function handleNext($conn) {
        $this->cleanupRandomChat($conn);
        // Immediately look for new
        $this->handleFindPartner($conn);
    }

    private function cleanupRandomChat($conn) {
        // Disconnect current partner if exists
        if (isset($this->pairs[$conn->resourceId])) {
            $partner = $this->pairs[$conn->resourceId];
            unset($this->pairs[$conn->resourceId]);
            unset($this->pairs[$partner->resourceId]);
            
            $partner->send(json_encode(['status' => 'disconnected', 'msg' => 'Stranger disconnected.']));
        }

        // Remove self from waiting list
        if ($this->waitingClient === $conn) {
            $this->waitingClient = null;
        }
    }

    // --- NEW: Nickname Generator ---
    private function generateNickname() {
        $adjs = ['Cool', 'Super', 'Lazy', 'Hyper', 'Happy', 'Sad', 'Wild', 'Neon', 'Dark', 'Fast'];
        $nouns = ['Panda', 'Tiger', 'Fox', 'Wolf', 'Cat', 'Dog', 'Bear', 'Eagle', 'Shark', 'Hawk'];
        
        $randAdj = $adjs[array_rand($adjs)];
        $randNoun = $nouns[array_rand($nouns)];
        $num = rand(100, 999);
        
        return $randAdj . $randNoun . $num;
    }

    public function onClose(ConnectionInterface $conn) {
        $this->cleanupRandomChat($conn);
        $this->clients->detach($conn);
        echo "Connection {$conn->resourceId} has disconnected\n";
        $this->broadcastUserCount();
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }

    private function broadcastUserCount() {
        $count = count($this->clients);
        $data = json_encode(['status' => 'stats', 'count' => $count]);
        foreach ($this->clients as $client) {
            $client->send($data);
        }
    }
}