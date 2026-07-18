import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';

/**
 * @swagger
 * /api/ws-info:
 *   get:
 *     tags: [WebSocket]
 *     summary: Get WebSocket server connection info
 *     responses:
 *       200:
 *         description: WebSocket server URL and usage instructions
 */
export async function GET(req: NextRequest) {
  const wsPort = process.env.WS_PORT || '4001';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const wsUrl = appUrl.replace(/^http/, 'ws').replace(':3000', `:${wsPort}`);

  return ok({
    ws_url: `${wsUrl}`,
    port: parseInt(wsPort),
    usage: {
      connect: `const ws = new WebSocket('${wsUrl}')`,
      on_message: 'ws.onmessage = (event) => { const msg = JSON.parse(event.data); }',
      message_types: {
        slot_updated: 'A slot or set of slots was updated (initial snapshot or regeneration)',
        slot_booked:  'A specific slot was booked by a user',
        slot_released: 'A booking was cancelled, slot is available again',
        slot_blocked: 'A slot was manually blocked by admin',
        ping_pong:    'Send { type: "ping" } to receive { type: "pong" }',
      },
    },
  });
}
