import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

const clients = new Set<WebSocket>();

export async function registerWsGateway(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, _req) => {
    clients.add(socket);
    app.log.info(`WS client connected (${clients.size} total)`);

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { timestamp: Date.now(), clients: clients.size },
    }));

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', payload: { timestamp: Date.now() } }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      app.log.info(`WS client disconnected (${clients.size} remaining)`);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });
  });
}

export function broadcastUpdate(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

export function getConnectedClients(): number {
  return clients.size;
}
