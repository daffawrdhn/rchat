<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class Chat implements MessageComponentInterface
{
    protected $clients;
    protected $waitingQueue;
    protected $pairs;
    protected $groups; // ['groupId' => [client1, client2, ...]]
    protected $groupActivity; // ['groupId' => timestamp]
    protected $redis;
    protected $ipConnections; // ['ip' => count]
    protected $config;

    public function __construct(array $config = [])
    {
        if (empty($config)) {
            $config = require __DIR__ . '/../config.php';
        }
        $this->config = $config;

        $this->clients = new \SplObjectStorage;
        $this->waitingQueue = [];
        $this->pairs = [];
        $this->groups = [];
        $this->groupActivity = [];
        $this->ipConnections = [];

        try {
            $this->redis = new \Redis();
            $this->redis->connect($this->config['redis_host'], $this->config['redis_port']);
        } catch (\Exception $e) {
            echo "Redis connection error: " . $e->getMessage() . "\n";
            $this->redis = null;
        }
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $ip = $this->getClientIp($conn);
        $conn->clientIp = $ip;

        $ipCount = isset($this->ipConnections[$ip]) ? $this->ipConnections[$ip] : 0;
        if ($ipCount >= $this->config['ip_connection_limit']) {
            echo "Connection rejected: IP $ip exceeded limit ($ipCount)\n";
            $conn->send(json_encode([
                'status' => 'system',
                'msg' => 'Too many connections from your IP address. Please close other tabs.'
            ]));
            $conn->close();
            return;
        }

        if (!isset($this->ipConnections[$ip])) {
            $this->ipConnections[$ip] = 0;
        }
        $this->ipConnections[$ip]++;

        // Initialize Anti-Spam & User Data
        $conn->nickname = $this->generateNickname();
        $conn->lastMsgTime = 0;
        $conn->spamWarnings = 0;
        $conn->currentGroup = null;
        $conn->matchMode = null;
        $conn->gender = 'any';
        $conn->targetGender = 'any';
        // Country flag feature disabled

        $this->clients->attach($conn);
        if ($this->redis) {
            $this->redis->incr('xoxo:user_count');
        }
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

            // Limit: 1 message every dynamic cooldown seconds
            if ($timeDiff < $this->config['anti_spam_cooldown']) {
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
            case 'set_profile':
                $from->send(json_encode([
                    'status' => 'identity',
                    'nickname' => $from->nickname
                ]));
                break;

            case 'join_room':
                $from->send(json_encode(['status' => 'room_joined', 'room' => $data['room']]));
                break;

            case 'cancel_search':
                $this->cleanupRandomChat($from);
                break;

            case 'find_partner':
                $this->handleFindPartner(
                    $from,
                    $data['mode'] ?? 'text',
                    $data['gender'] ?? 'any',
                    $data['targetGender'] ?? 'any'
                );
                break;

            case 'join_group':
                $this->handleJoinGroup($from, $data['group_id'] ?? '');
                break;

            case 'leave_group':
                $this->cleanupGroupChat($from);
                $from->send(json_encode(['status' => 'group_kicked']));
                break;

            case 'message':
                $context = $data['context'] ?? 'public';
                $type = $data['type'] ?? 'text'; // 'text' or 'image'
                $content = $data['content'] ?? '';

                // SECURITY: Sanitize text and validate Base64 image
                if ($type === 'text') {
                    $content = htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
                } elseif ($type === 'image') {
                    // Length check to prevent abuse, allowing base64, URL, or ciphertext (Max 500KB)
                    if (strlen($content) > 500000) {
                        return;
                    }
                } elseif ($type === 'audio') {
                    // Length check to prevent abuse, allowing base64, URL, or ciphertext (Max 2MB)
                    if (strlen($content) > 2000000) {
                        return;
                    }
                } else {
                    return; // Block unknown types
                }

                if (($context === 'random' || $context === 'video') && isset($this->pairs[$from->resourceId])) {
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
                if (($context === 'random' || $context === 'video') && isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode(['status' => 'read', 'context' => $context]));
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

    private function handleFindPartner($conn, $mode = 'text', $gender = 'any', $targetGender = 'any')
    {
        $conn->matchMode = $mode;
        $conn->gender = $gender;
        $conn->targetGender = $targetGender;

        // Check if already in pair
        if (isset($this->pairs[$conn->resourceId])) {
            return;
        }

        // Check if already in waiting queue
        foreach ($this->waitingQueue as $waitingConn) {
            if ($waitingConn === $conn) {
                return;
            }
        }

        // Try to match with someone in the queue
        $matchedPartner = null;
        foreach ($this->waitingQueue as $index => $partner) {
            // Must be the same matchMode (text vs video)
            if ($partner->matchMode !== $conn->matchMode) {
                continue;
            }

            // Check if partner's gender is what conn wants
            $connTargetOk = ($conn->targetGender === 'any' || $conn->targetGender === $partner->gender);

            // Check if conn's gender is what partner wants
            $partnerTargetOk = ($partner->targetGender === 'any' || $partner->targetGender === $conn->gender);

            if ($connTargetOk && $partnerTargetOk) {
                $matchedPartner = $partner;
                unset($this->waitingQueue[$index]);
                $this->waitingQueue = array_values($this->waitingQueue);
                break;
            }
        }

        if ($matchedPartner !== null) {
            $this->pairs[$conn->resourceId] = $matchedPartner;
            $this->pairs[$matchedPartner->resourceId] = $conn;

            $sharedKey = bin2hex(random_bytes(16));

            $conn->send(json_encode([
                'status' => 'connected',
                'shared_key' => $sharedKey,
                'nickname' => $matchedPartner->nickname,
                'mode' => $mode,
                'initiator' => true,
                'msg' => 'Stranger found! Say hello.'
            ]));
            $matchedPartner->send(json_encode([
                'status' => 'connected',
                'shared_key' => $sharedKey,
                'nickname' => $conn->nickname,
                'mode' => $mode,
                'initiator' => false,
                'msg' => 'Stranger found! Say hello.'
            ]));
        } else {
            $this->waitingQueue[] = $conn;
            $conn->send(json_encode(['status' => 'waiting', 'msg' => 'Looking for a stranger...']));
        }
    }

    private function handleTyping($from, $context)
    {
        if (($context === 'random' || $context === 'video' || $context === 'voice') && isset($this->pairs[$from->resourceId])) {
            $partner = $this->pairs[$from->resourceId];
            $partner->send(json_encode(['status' => 'typing', 'context' => $context]));
        } elseif ($context === 'group' && $from->currentGroup && isset($this->groups[$from->currentGroup])) {
             foreach ($this->groups[$from->currentGroup] as $client) {
                if ($client !== $from) {
                    $client->send(json_encode(['status' => 'typing', 'context' => 'group', 'name' => $from->nickname]));
                }
            }
        } elseif ($context === 'public') {
            foreach ($this->clients as $client) {
                if ($client !== $from) {
                    $client->send(json_encode(['status' => 'typing', 'context' => 'public', 'name' => $from->nickname]));
                }
            }
        }
    }

    private function handleNext($conn)
    {
        $this->cleanupRandomChat($conn);
        $mode = isset($conn->matchMode) ? $conn->matchMode : 'text';
        $gender = isset($conn->gender) ? $conn->gender : 'any';
        $targetGender = isset($conn->targetGender) ? $conn->targetGender : 'any';
        $this->handleFindPartner($conn, $mode, $gender, $targetGender);
    }

    private function cleanupRandomChat($conn)
    {
        if (isset($this->pairs[$conn->resourceId])) {
            $partner = $this->pairs[$conn->resourceId];
            unset($this->pairs[$conn->resourceId]);
            unset($this->pairs[$partner->resourceId]);

            $partner->send(json_encode(['status' => 'disconnected', 'msg' => 'Stranger disconnected.']));
        }

        foreach ($this->waitingQueue as $index => $waitingConn) {
            if ($waitingConn === $conn) {
                unset($this->waitingQueue[$index]);
                $this->waitingQueue = array_values($this->waitingQueue);
                break;
            }
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
        $adjs = ['Sweet', 'Naughty', 'Hot', 'Dreamy', 'Flirty', 'Spicy', 'Playful', 'Cheeky', 'Sassy', 'Lovely', 'Cute', 'Sexy', 'Charming', 'Cuddly', 'Wild'];
        $nouns = ['Babe', 'Angel', 'Kitten', 'Bunny', 'Cutie', 'Cherry', 'Peach', 'Sweetie', 'Honey', 'Beauty', 'Darling', 'Sugar', 'Princess', 'Prince', 'Bae'];
        return $adjs[array_rand($adjs)] . $nouns[array_rand($nouns)] . rand(100, 999);
    }

    public function onClose(ConnectionInterface $conn)
    {
        if (isset($conn->clientIp) && isset($this->ipConnections[$conn->clientIp])) {
            $this->ipConnections[$conn->clientIp]--;
            if ($this->ipConnections[$conn->clientIp] <= 0) {
                unset($this->ipConnections[$conn->clientIp]);
            }
        }

        $this->cleanupRandomChat($conn);
        $this->cleanupGroupChat($conn);
        $this->clients->detach($conn);
        if ($this->redis) {
            $this->redis->decr('xoxo:user_count');
        }
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
        $count = $this->redis ? (int)$this->redis->get('xoxo:user_count') : count($this->clients);
        if ($count < 0) $count = count($this->clients);

        $data = json_encode(['status' => 'stats', 'count' => $count]);
        foreach ($this->clients as $client) {
            $client->send($data);
        }
    }

    private function getClientIp(ConnectionInterface $conn)
    {
        $headers = [
            'CF-Connecting-IP',
            'X-Forwarded-For',
            'X-Real-IP',
            'Client-IP'
        ];

        if (isset($conn->httpRequest)) {
            foreach ($headers as $header) {
                $value = $conn->httpRequest->getHeader($header);
                if (!empty($value)) {
                    $ipList = explode(',', $value[0]);
                    $ip = trim($ipList[0]);
                    if (filter_var($ip, FILTER_VALIDATE_IP)) {
                        return $ip;
                    }
                }
            }
        }

        return $conn->remoteAddress ?? '127.0.0.1';
    }
}