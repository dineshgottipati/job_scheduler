import { WebSocket } from 'ws';
import { WsEvent } from '@job-scheduler/shared';

const clients = new Set<any>();

export function registerWsClient(ws: any) {
  if (!ws) return;
  const socket = ws.socket || ws.raw || ws;
  if (!socket || typeof socket.on !== 'function') return;

  clients.add(socket);

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
}

export function broadcastWsEvent<T>(event: WsEvent['event'], data: T) {
  const payload: WsEvent<T> = {
    event,
    data,
    timestamp: new Date().toISOString()
  };
  const json = JSON.stringify(payload);

  for (const client of Array.from(clients)) {
    if (!client || typeof client.readyState === 'undefined') {
      clients.delete(client);
      continue;
    }

    const state = client.readyState;
    if (state === 1 || state === WebSocket.OPEN) {
      try {
        client.send(json);
      } catch (err) {
        console.error('Failed to send WS event:', err);
        clients.delete(client);
      }
    } else if (state === 2 || state === 3) {
      clients.delete(client);
    }
  }
}
