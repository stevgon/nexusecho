import { Hono, Context } from "hono";
import { Env } from './core-utils';
import "./durableObject";
import type { ApiResponse, WsAttempt } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  const getGlobalStub = (c: Context<{ Bindings: Env }>) => {
    if (!c.env.GlobalDurableObject) {
      console.error('[DO Helper] Critical: GlobalDurableObject binding missing');
      throw new Error('Missing GlobalDurableObject binding');
    }
    return c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
  };
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'NexusEcho API' } }));
  // Dedicated HTTP health check for the Durable Object
  app.get('/api/health-do', async (c) => {
    try {
      const stub = getGlobalStub(c);
      // Proxy a standard HTTP request to the DO fetch handler
      return await stub.fetch(c.req.raw);
    } catch (err) {
      console.error('[Health DO Error]', err);
      return c.json({ success: false, error: 'Durable Object health check failed' }, 500);
    }
  });
  // Hardened WebSocket proxy endpoint
  app.get('/api/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade') || '';
    const connectionHeader = c.req.header('Connection') || '';
    // Strict Cloudflare-aligned WebSocket validation
    const isWebSocket = upgradeHeader.toLowerCase() === 'websocket';
    const isUpgrade = connectionHeader.toLowerCase().includes('upgrade');
    if (!isWebSocket || !isUpgrade) {
      console.warn(`[WS Reject] Invalid handshake attempt: Upgrade=${upgradeHeader}, Conn=${connectionHeader}`);
      return new Response("Expected websocket", { status: 426 });
    }
    try {
      const stub = getGlobalStub(c);
      console.log(`[WS Proxy] Forwarding valid handshake to DO: ${stub.id.toString()}`);
      return await stub.fetch(c.req.raw);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.error(`[WS Proxy Error] Handshake forwarding failed:\n${errorObj.stack}`);
      return c.json({
        success: false,
        error: 'Uplink handshake failed',
        detail: errorObj.message
      }, 500);
    }
  });
  app.get('/api/ws-diag', async (c) => {
    try {
      const stub = getGlobalStub(c);
      const attempts = await stub.getWsAttempts();
      return c.json({ success: true, data: attempts } satisfies ApiResponse<WsAttempt[]>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to fetch diagnostics' }, 500);
    }
  });
  app.get('/api/counter', async (c) => {
    try {
      const stub = getGlobalStub(c);
      const data = await stub.getCounterValue();
      return c.json({ success: true, data } satisfies ApiResponse<number>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to fetch counter' }, 500);
    }
  });
  app.post('/api/counter/increment', async (c) => {
    try {
      const stub = getGlobalStub(c);
      const data = await stub.increment();
      return c.json({ success: true, data } satisfies ApiResponse<number>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to increment counter' }, 500);
    }
  });
}