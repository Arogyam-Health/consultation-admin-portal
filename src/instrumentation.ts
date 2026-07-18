/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to boot the WebSocket server alongside the HTTP server.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid edge runtime issues
    const { initWsServer } = await import('@/lib/websocket/server');
    initWsServer();
    console.log('[Instrumentation] WebSocket server initialized');
  }
}
