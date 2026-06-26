<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class Chat implements MessageComponentInterface
{
    protected $clients;
    protected $waitingClient;
    protected $pairs;
    protected $groups; // ['groupId' => [client1, client2, ...]]
    protected $groupActivity; // ['groupId' => timestamp]

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        $this->waitingClient = null;
        $this->pairs = [];
        $this->groups = [];
        $this->groupActivity = [];
    }

    public function onOpen(ConnectionInterface $conn)
    {
        // Initialize Anti-Spam & User Data
        $conn->nickname = $this->generateNickname();
        $conn->lastMsgTime = 0;
        $conn->spamWarnings = 0;
        $conn->currentGroup = null;

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

            case 'cancel_search':
                $this->cleanupRandomChat($from);
                break;

            case 'find_partner':
                $this->handleFindPartner($from);
                break;

            case 'join_group':
                $this->handleJoinGroup($from, $data['group_id'] ?? '');
                break;

            case 'message':
                $context = $data['context'] ?? 'public';
                $type = $data['type'] ?? 'text'; // 'text' or 'image'
                $content = $data['content'] ?? '';

                // SECURITY: Sanitize text and validate Base64 image
                if ($type === 'text') {
                    $content = htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
                } elseif ($type === 'image') {
                    if (strlen($content) > 150000 || !preg_match('/^data:image\/(jpeg|png|webp|gif);base64,/', $content)) {
                        return; // Block invalid or too large images
                    }
                } elseif ($type === 'audio') {
                    if (strlen($content) > 1000000 || !preg_match('/^data:audio\/(webm|ogg|mp3|wav|mp4);base64,/', $content)) {
                        return; // Block invalid or too large audio
                    }
                } else {
                    return; // Block unknown types
                }

                if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
                    $this->handlePrivateMessage($from, $content, $type);
                } elseif ($context === 'group' && $from->currentGroup) {
                    $this->handleGroupMessage($from, $content, $type);
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

            case 'read':
                $context = $data['context'] ?? 'random';
                if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode(['status' => 'read', 'context' => 'random']));
                } elseif ($context === 'group' && $from->currentGroup) {
                    $groupId = $from->currentGroup;
                    foreach ($this->groups[$groupId] as $client) {
                        if ($client !== $from) {
                            $client->send(json_encode(['status' => 'read', 'context' => 'group']));
                        }
                    }
                }
                break;

            case 'typing':
                $this->handleTyping($from, $data['context'] ?? 'random');
                break;

            case 'next':
                $this->handleNext($from);
                break;
        }
    }

    private function handleJoinGroup($from, $groupId)
    {
        $groupId = trim($groupId);
        if (empty($groupId)) {
            $from->send(json_encode(['status' => 'error', 'msg' => 'Room code cannot be empty.']));
            return;
        }

        // Create room if it doesn't exist
        if (!isset($this->groups[$groupId])) {
            $this->groups[$groupId] = new \SplObjectStorage;
            $this->groupActivity[$groupId] = time();
        }

        $this->groups[$groupId]->attach($from);
        $from->currentGroup = $groupId;
        $this->groupActivity[$groupId] = time();

        // Notify user
        $from->send(json_encode([
            'status' => 'group_joined',
            'group_id' => $groupId,
            'msg' => 'You joined the room: ' . $groupId
        ]));

        // Notify others
        foreach ($this->groups[$groupId] as $client) {
            if ($client !== $from) {
                $client->send(json_encode([
                    'status' => 'group_system',
                    'msg' => "{$from->nickname} joined the room."
                ]));
            }
        }
    }

    public function cleanupInactiveGroups()
    {
        $currentTime = time();
        foreach ($this->groups as $groupId => $clients) {
            $lastActivity = $this->groupActivity[$groupId] ?? $currentTime;
            
            // 5 minutes = 300 seconds
            if (($currentTime - $lastActivity) > 300) {
                foreach ($clients as $client) {
                    $client->send(json_encode([
                        'status' => 'group_system',
                        'msg' => 'Room was deleted due to 5 minutes of inactivity.'
                    ]));
                    $client->send(json_encode([
                        'status' => 'group_kicked'
                    ]));
                    $client->currentGroup = null;
                }
                
                unset($this->groups[$groupId]);
                unset($this->groupActivity[$groupId]);
                echo "Room $groupId deleted due to inactivity.\n";
            }
        }
    }

    private function handleGroupMessage($from, $msg, $type)
    {
        $groupId = $from->currentGroup;
        if (!isset($this->groups[$groupId])) return;

        $this->groupActivity[$groupId] = time();

        $payload = json_encode([
            'status' => 'group_msg',
            'name' => $from->nickname,
            'msg' => $msg,
            'type' => $type,
            'is_me' => false
        ]);

        foreach ($this->groups[$groupId] as $client) {
            if ($client !== $from) {
                $client->send($payload);
            }
        }
    }

    private function handlePublicMessage($from, $msg, $type)
    {

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
            $this->waitingClient = null;

            $this->pairs[$conn->resourceId] = $partner;
            $this->pairs[$partner->resourceId] = $conn;

            $sharedKey = bin2hex(random_bytes(16));

            $conn->send(json_encode([
                'status' => 'connected',
                'shared_key' => $sharedKey,
                'msg' => 'Stranger found! Say hello.'
            ]));
            $partner->send(json_encode([
                'status' => 'connected',
                'shared_key' => $sharedKey,
                'msg' => 'Stranger found! Say hello.'
            ]));
        } else {
            $this->waitingClient = $conn;
            $conn->send(json_encode(['status' => 'waiting', 'msg' => 'Looking for a stranger...']));
        }
    }

    private function handleTyping($from, $context)
    {
        if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'typing']));
        } elseif ($context === 'group' && $from->currentGroup && isset($this->groups[$from->currentGroup])) {
             foreach ($this->groups[$from->currentGroup] as $client) {
                if ($client !== $from) {
                    $client->send(json_encode(['status' => 'typing', 'context' => 'group']));
                }
            }
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

    private function cleanupGroupChat($conn)
    {
        if ($conn->currentGroup && isset($this->groups[$conn->currentGroup])) {
            $groupId = $conn->currentGroup;
            $this->groups[$groupId]->detach($conn);
            
            // Notify others
            foreach ($this->groups[$groupId] as $client) {
                $client->send(json_encode([
                    'status' => 'group_system',
                    'msg' => "{$conn->nickname} left the group."
                ]));
            }

            // Clean up empty groups
            if ($this->groups[$groupId]->count() === 0) {
                unset($this->groups[$groupId]);
                unset($this->groupActivity[$groupId]);
            }
            
            $conn->currentGroup = null;
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
        $this->cleanupGroupChat($conn);
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