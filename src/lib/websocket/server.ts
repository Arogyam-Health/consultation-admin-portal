import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { supabaseAdmin } from '@/lib/supabase';

export type WsMessageType =
  | 'slot_updated'
  | 'slot_booked'
  | 'slot_released'
  | 'slot_blocked'
  | 'ping'
  | 'pong'
  | 'error';

export interface WsMessage {
  type: WsMessageType;
  payload?: unknown;
  timestamp: string;
}

let wss: WebSocketServer | null = null;

/** Initialise the WebSocket server on a dedicated port (WS_PORT env). */
export function initWsServer() {
  if (wss) return wss;

  const port = parseInt(process.env.WS_PORT || '4001', 10);

  wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`[WS] WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

    // Send initial snapshot
    try {
      const date = new Date().toISOString().split('T')[0];
      const { data: slots } = await supabaseAdmin
        .from('consultant_slots')
        .select('id, consultant_id, slot_date, start_time, end_time, duration_mins, status')
        .gte('slot_date', date)
        .order('start_time', { ascending: true })
        .limit(200);

      send(ws, { type: 'slot_updated', payload: { slots }, timestamp: new Date().toISOString() });
    } catch {
      /* non-fatal */
    }

    ws.on('message', (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          send(ws, { type: 'pong', timestamp: new Date().toISOString() });
        }
      } catch {
        send(ws, { type: 'error', payload: 'Invalid JSON', timestamp: new Date().toISOString() });
      }
    });

    ws.on('close', () => console.log('[WS] Client disconnected'));
    ws.on('error', (err) => console.error('[WS] Socket error:', err.message));
  });

  return wss;
}

/** Broadcast a message to all connected WebSocket clients. */
export function broadcastSlotUpdate(message: WsMessage) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function send(ws: WebSocket, msg: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export { wss };
