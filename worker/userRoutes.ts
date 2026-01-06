import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, WsAttempt } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'NexusEcho API' } }));
  app.get('/api/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade') || '';
    const connectionHeader = c.req.header('Connection') || '';
    const host = c.req.header('Host') || 'unknown';
    const origin = c.req.header('Origin') || 'unknown';
    const ua = c.req.header('User-Agent') || 'unknown';
    console.log(`[WS Handshake Request] Path: ${c.req.path}, Host: ${host}, Upgrade: ${upgradeHeader}, Connection: ${connectionHeader}`);
    // Case-insensitive check for websocket protocol
    if (!upgradeHeader.toLowerCase().includes('websocket')) {
      console.warn(`[WS Handshake Rejected] Missing Upgrade: websocket header. Got: ${upgradeHeader}`);
      return c.text('Expected Upgrade: websocket', 426);
    }
    try {
      const id = c.env.GlobalDurableObject.idFromName("global");
      const stub = c.env.GlobalDurableObject.get(id);
      console.log(`[Proxying to DO] Handing off request to GlobalDurableObject: ${id.toString()}`);
      // Pass the raw request to the Durable Object
      return await stub.fetch(c.req.raw);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[DO Proxy Error] Failed to reach or communicate with Durable Object: ${errorMessage}`);
      return c.json({ 
        success: false, 
        error: 'Durable Object connection failed', 
        detail: errorMessage 
      }, 500);
    }
  });
  app.get('/api/ws-diag', async (c) => {
    try {
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const attempts = await stub.getWsAttempts();
      return c.json({ success: true, data: attempts } satisfies ApiResponse<WsAttempt[]>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to fetch diagnostics' }, 500);
    }
  });
  app.get('/api/counter', async (c) => {
    const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
    const data = await durableObjectStub.getCounterValue();
    return c.json({ success: true, data } satisfies ApiResponse<number>);
  });
  app.post('/api/counter/increment', async (c) => {
    const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
    const data = await durableObjectStub.increment();
    return c.json({ success: true, data } satisfies ApiResponse<number>);
  });
}