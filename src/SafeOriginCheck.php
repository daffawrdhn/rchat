<?php
namespace MyApp;

use Ratchet\ConnectionInterface;
use Ratchet\Http\OriginCheck;
use Psr\Http\Message\RequestInterface;

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
            return $this->close($conn, 403);
        }

        return $this->_component->onOpen($conn, $request);
    }
}
