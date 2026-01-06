import { Hono, Context } from "hono";
import { Env } from './core-utils';
import "./durableObject";
import type { ApiResponse, WsAttempt } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  const getGlobalStub = (c: Context<{ Bindings: Env }>) => {
    if (!c.env.GlobalDurableObject) {
      const error = new Error('Missing GlobalDurableObject binding');
      console.error('[DO Helper] Missing GlobalDurableObject binding');
      throw error;
    }
    return c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
  };

  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'NexusEcho API' } }));
  app.get('/api/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade') || '';
    const connectionHeader = c.req.header('Connection') || '';
    const host = c.req.header('Host') || 'unknown';
    const origin = c.req.header('Origin') || 'unknown';
    const ua = c.req.header('User-Agent') || 'unknown';
    console.log(`[WS Handshake Request] Path: ${c.req.path}, Host: ${host}, Upgrade: ${upgradeHeader}, Connection: ${connectionHeader}`);

    let stub;
    try {
      stub = getGlobalStub(c);
    } catch (err) {
      console.error('[DO Proxy] Missing GlobalDurableObject binding');
      return c.json({ success: false, error: 'Missing GlobalDurableObject binding', detail: 'Check wrangler.jsonc durable_objects bindings' }, 500);
    }
    
    if (!upgradeHeader.toLowerCase().includes('websocket')) {
      console.log(`[HTTP Health Check] Plain GET from ${host}, proxying to DO`);
    } else {
      console.log(`[WS Upgrade Request] Proxying to DO: ${stub.id.toString()}`);
    }
    
    try {
      // Pass the raw request to the Durable Object
      return await stub.fetch(c.req.raw);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const fullStack = errorObj.stack || errorObj.message || String(err);
      console.error(`[DO Proxy Error] Failed to reach or communicate with Durable Object:\n${fullStack}`);
      const detail = fullStack.length > 500 ? fullStack.slice(0, 500) + '...' : fullStack;
      return c.json({
        success: false,
        error: 'Durable Object connection failed',
        detail
      }, 500);
    }
  });
  app.get('/api/ws-diag', async (c) => {
    let stub;
    try {
      stub = getGlobalStub(c);
    } catch (err) {
      console.error('[DO Proxy] Missing GlobalDurableObject binding');
      return c.json({ success: false, error: 'Missing GlobalDurableObject binding', detail: 'Check wrangler.jsonc durable_objects bindings' }, 500);
    }
    try {
      const attempts = await stub.getWsAttempts();
      return c.json({ success: true, data: attempts } satisfies ApiResponse<WsAttempt[]>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to fetch diagnostics' }, 500);
    }
  });
  app.get('/api/counter', async (c) => {
    let durableObjectStub;
    try {
      durableObjectStub = getGlobalStub(c);
    } catch (err) {
      console.error('[DO Proxy] Missing GlobalDurableObject binding');
      return c.json({ success: false, error: 'Missing GlobalDurableObject binding', detail: 'Check wrangler.jsonc durable_objects bindings' }, 500);
    }
    try {
      const data = await durableObjectStub.getCounterValue();
      return c.json({ success: true, data } satisfies ApiResponse<number>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to fetch counter' }, 500);
    }
  });
  app.post('/api/counter/increment', async (c) => {
    let durableObjectStub;
    try {
      durableObjectStub = getGlobalStub(c);
    } catch (err) {
      console.error('[DO Proxy] Missing GlobalDurableObject binding');
      return c.json({ success: false, error: 'Missing GlobalDurableObject binding', detail: 'Check wrangler.jsonc durable_objects bindings' }, 500);
    }
    try {
      const data = await durableObjectStub.increment();
      return c.json({ success: true, data } satisfies ApiResponse<number>);
    } catch (err) {
      return c.json({ success: false, error: 'Failed to increment counter' }, 500);
    }
  });
}