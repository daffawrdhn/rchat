<?php
namespace MyApp;

use Ratchet\ConnectionInterface;
use Ratchet\Http\OriginCheck;
use Psr\Http\Message\RequestInterface;
use GuzzleHttp\Psr7\Message;
use GuzzleHttp\Psr7\Response;

class SafeOriginCheck extends OriginCheck
{
    public function onOpen(ConnectionInterface $conn, RequestInterface $request = null)
    {
        $originHeader = $request ? $request->getHeader('Origin') : [];
        $origin = isset($originHeader[0]) ? (string)$originHeader[0] : '';

        if ($origin === '') {
            return $this->_component->onOpen($conn, $request);
        }

        $host = parse_url($origin, PHP_URL_HOST) ?: $origin;

        if (!in_array($host, $this->allowedOrigins)) {
            $found = false;
            foreach ($this->allowedOrigins as $allowed) {
                if (str_ends_with($host, '.' . $allowed)) {
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $response = new Response(403, ['X-Powered-By' => \Ratchet\VERSION]);
                $conn->send(Message::toString($response));
                $conn->close();
                return;
            }
        }

        return $this->_component->onOpen($conn, $request);
    }
}
