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

server.on('upgrade', (request, socket, head) => {
  const match = request.url?.match(/^\/tunnel\/([^/?]+)/);
  if (match) {
    const deviceId = match[1];
    // TODO: Verify Authorization header
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, deviceId);
    });
  } else {
    socket.destroy();
  }
});

// Relay HTTP endpoint for the backend to call
app.all('/relay/:deviceId/*', async (req, res) => {
  const { deviceId } = req.params;
  const path = '/' + req.params[0] + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  
  const ws = connections.get(deviceId);
  if (!ws) {
    return res.status(502).json({ error: 'Device not connected' });
  }

  const requestId = crypto.randomUUID();
  const relayRequest = {
    requestId,
    method: req.method,
    path,
    headers: req.headers,
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
    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v as string);
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
