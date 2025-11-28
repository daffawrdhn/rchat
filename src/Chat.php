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
        $conn->nickname = "Stranger"; // Default Omegle name
        $this->clients->attach($conn);
        $conn->send(json_encode(['status' => 'identity', 'nickname' => $conn->nickname]));
        $this->broadcastUserCount();
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $data = json_decode($msg, true);
        if (!isset($data['action']))
            return;

        switch ($data['action']) {
            case 'find_partner':
                $this->handleFindPartner($from);
                break;
            case 'message':
                if (isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode(['status' => 'message', 'msg' => $data['content']]));
                }
                break;
            case 'call_signal':
                if (isset($this->pairs[$from->resourceId])) {
                    $partner = $this->pairs[$from->resourceId];
                    $partner->send(json_encode(['status' => 'call_signal', 'signal' => $data['data']]));
                }
                break;
            case 'typing':
                if (isset($this->pairs[$from->resourceId])) {
                    $this->pairs[$from->resourceId]->send(json_encode(['status' => 'typing']));
                }
                break;
            case 'next':
                $this->cleanupRandomChat($from);
                $this->handleFindPartner($from); // Auto search new
                break;
            case 'disconnect': // Manual disconnect
                $this->cleanupRandomChat($from);
                break;
        }
    }

    private function handleFindPartner($conn)
    {
        if (isset($this->pairs[$conn->resourceId]) || $this->waitingClient === $conn)
            return;

        if ($this->waitingClient !== null && $this->waitingClient !== $conn) {
            $partner = $this->waitingClient;
            $this->pairs[$conn->resourceId] = $partner;
            $this->pairs[$partner->resourceId] = $conn;
            $this->waitingClient = null;

            $conn->send(json_encode(['status' => 'connected', 'msg' => 'You are now chatting with a random stranger. Say hi!']));
            $partner->send(json_encode(['status' => 'connected', 'msg' => 'You are now chatting with a random stranger. Say hi!']));
        } else {
            $this->waitingClient = $conn;
            $conn->send(json_encode(['status' => 'waiting', 'msg' => 'Looking for someone you can chat with...']));
        }
    }

    private function cleanupRandomChat($conn)
    {
        if (isset($this->pairs[$conn->resourceId])) {
            $partner = $this->pairs[$conn->resourceId];
            unset($this->pairs[$conn->resourceId]);
            unset($this->pairs[$partner->resourceId]);
            $partner->send(json_encode(['status' => 'disconnected', 'msg' => 'Stranger has disconnected.']));
        }
        if ($this->waitingClient === $conn)
            $this->waitingClient = null;
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->cleanupRandomChat($conn);
        $this->clients->detach($conn);
        $this->broadcastUserCount();
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        $conn->close();
    }

    private function broadcastUserCount()
    {
        $count = count($this->clients);
        foreach ($this->clients as $client) {
            $client->send(json_encode(['status' => 'stats', 'count' => $count]));
        }
    }
}