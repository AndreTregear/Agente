import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// deviceId -> WebSocket
const connections = new Map<string, WebSocket>();

// requestId -> callback
const pendingRequests = new Map<string, { resolve: (res: any) => void; reject: (err: Error) => void }>();

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage, deviceId: string) => {
  console.log(`[Relay] Device connected: ${deviceId}`);
  connections.set(deviceId, ws);

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      // Expecting RelayResponse: { requestId, statusCode, headers, body }
      if (data.requestId && pendingRequests.has(data.requestId)) {
        pendingRequests.get(data.requestId)?.resolve(data);
        pendingRequests.delete(data.requestId);
      }
    } catch (err) {
      console.error(`[Relay] Error parsing message from ${deviceId}:`, err);
    }
  });

  ws.on('close', () => {
    console.log(`[Relay] Device disconnected: ${deviceId}`);
    connections.delete(deviceId);
  });
});

const RELAY_AUTH_TOKEN = process.env.RELAY_AUTH_TOKEN;
if (!RELAY_AUTH_TOKEN) {
  console.error('[Relay] FATAL: RELAY_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

server.on('upgrade', (request, socket, head) => {
  const match = request.url?.match(/^\/tunnel\/([^/?]+)/);
  if (!match) {
    socket.destroy();
    return;
  }

  const deviceId = match[1];

  // Verify auth token
  const token = extractBearerToken(request.headers.authorization);
  if (!token || !safeTokenCompare(token, RELAY_AUTH_TOKEN)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, deviceId);
  });
});

// Relay HTTP endpoint for the backend to call (authenticated)
app.all('/relay/:deviceId/*', async (req, res) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token || !safeTokenCompare(token, RELAY_AUTH_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { deviceId } = req.params;
  const path = '/' + req.params[0] + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  
  const ws = connections.get(deviceId);
  if (!ws) {
    return res.status(502).json({ error: 'Device not connected' });
  }

  const requestId = crypto.randomUUID();
  // Only forward safe headers to the device
  const safeHeaders: Record<string, string> = {};
  for (const key of ['content-type', 'accept', 'x-request-id']) {
    if (req.headers[key]) safeHeaders[key] = req.headers[key] as string;
  }

  const relayRequest = {
    requestId,
    method: req.method,
    path,
    headers: safeHeaders,
    body: Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null,
  };

  const promise = new Promise<any>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    // Timeout after 15 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Device timeout'));
      }
    }, 15000);
  });

  ws.send(JSON.stringify(relayRequest));

  try {
    const response = await promise;
    res.status(response.statusCode || 200);
    // Only allow safe response headers from device
    const allowedResponseHeaders = ['content-type', 'content-length', 'x-request-id'];
    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        if (allowedResponseHeaders.includes(k.toLowerCase())) {
          res.setHeader(k, v as string);
        }
      }
    }
    if (response.body) {
      res.send(response.body);
    } else {
      res.end();
    }
  } catch (err: any) {
    res.status(504).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8092;
server.listen(PORT, () => {
  console.log(`[Relay] Server running on port ${PORT}`);
});
