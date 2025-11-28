<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class Chat implements MessageComponentInterface
{
    protected $clients;
    protected $waitingClient; // Antrean user random chat
    protected $pairs;         // Pasangan user random chat

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        $this->waitingClient = null;
        $this->pairs = [];
    }

    public function onOpen(ConnectionInterface $conn)
    {
        // Generate Nickname Unik
        $conn->nickname = $this->generateNickname();

        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId}) assigned name: {$conn->nickname}\n";

        // Kirim identitas ke user
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

        switch ($data['action']) {
            case 'join_room':
                // User pindah tab (Random <-> Public). 
                // Kita TIDAK memutus koneksi random chat agar voice call tetap jalan.
                // Hanya kirim konfirmasi ke client.
                $from->send(json_encode([
                    'status' => 'room_joined',
                    'room' => $data['room']
                ]));
                break;

            case 'find_partner':
                $this->handleFindPartner($from);
                break;

            case 'message':
                // Cek konteks pesan: apakah untuk Random (Private) atau Public
                $context = $data['context'] ?? 'public';

                if ($context === 'random' && isset($this->pairs[$from->resourceId])) {
                    $this->handlePrivateMessage($from, $data['content'] ?? '');
                } else {
                    $this->handlePublicMessage($from, $data['content'] ?? '');
                }
                break;

            // --- LOGIKA VOICE CALL (WEBRTC) ---
            case 'call_signal':
                // Server hanya bertugas meneruskan data signal (Offer/Answer/ICE)
                // dari pengirim ke pasangannya.
                if (isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode([
                        'status' => 'call_signal',
                        'signal' => $data['data']
                    ]));
                }
                break;
            // ----------------------------------

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
            // Broadcast ke SEMUA user (kecuali pengirim)
            // Agar user di tab 'Random' tetap dapat notifikasi badge public
            if ($client !== $from) {
                $client->send($payload);
            }
        }
    }

    private function handleFindPartner($conn)
    {
        // Jika sudah punya pasangan atau sedang menunggu, abaikan
        if (isset($this->pairs[$conn->resourceId]) || $this->waitingClient === $conn) {
            return;
        }

        if ($this->waitingClient !== null && $this->waitingClient !== $conn) {
            // Match found!
            $partner = $this->waitingClient;

            $this->pairs[$conn->resourceId] = $partner;
            $this->pairs[$partner->resourceId] = $conn;
            $this->waitingClient = null;

            $conn->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found! Say hello.']));
            $partner->send(json_encode(['status' => 'connected', 'msg' => 'Stranger found! Say hello.']));
        } else {
            // Masuk antrean
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
        // Putuskan hubungan dengan pasangan saat ini
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