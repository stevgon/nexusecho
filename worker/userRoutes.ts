import { Hono, Context } from "hono";
import { Env } from './core-utils';
import "./durableObject";
import type { ApiResponse, WsAttempt, WorkerStatusResponse, DiagnosticSummary } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  const getGlobalStub = (c: Context<{ Bindings: Env }>) => {
    if (!c.env.GlobalDurableObject) {
      console.error('[DO Helper] Critical: GlobalDurableObject binding missing');
      throw new Error('Missing GlobalDurableObject binding');
    }
    return c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('global'));
  };
  // NEW: System-level observability endpoint
  app.get('/api/worker-status', async (c) => {
    const status: WorkerStatusResponse = {
      binding: c.env.GlobalDurableObject ? 'available' : 'missing',
      stub: 'failed',
      doLogic: 'unreachable',
      userRoutesLoaded: true, // If we're here, they are loaded
      timestamp: new Date().toISOString()
    };
    try {
      const stub = getGlobalStub(c);
      status.stub = 'created';
      // Test DO reachability via internal sub-request
      const testRes = await stub.fetch(new Request("http://internal/api/test"));
      if (testRes.ok) {
        status.doLogic = 'reachable';
      }
    } catch (err) {
      status.details = err instanceof Error ? err.message : String(err);
    }
    return c.json(status);
  });
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'NexusEcho API' } }));
  app.get('/api/health-do', async (c) => {
    try {
      const stub = getGlobalStub(c);
      return await stub.fetch(c.req.raw);
    } catch (err) {
      console.error('[Health DO Error]', err);
      return c.json({ success: false, error: 'Durable Object health check failed' }, 500);
    }
  });
  app.get('/api/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade') || '';
    const connectionHeader = c.req.header('Connection') || '';
    // Verbose logging for infrastructure hardening
    console.error(`[WS Handshake Received] Protocol: ${c.req.raw.url}, Method: ${c.req.method}`);
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((val, key) => { headers[key] = val; });
    console.error(`[WS Headers Snapshot] ${JSON.stringify(headers)}`);
    const isWebSocket = upgradeHeader.toLowerCase() === 'websocket';
    const isUpgrade = connectionHeader.toLowerCase().includes('upgrade');
    if (!isWebSocket || !isUpgrade) {
      console.error(`[WS Reject] Invalid handshake: Upgrade=${upgradeHeader}, Conn=${connectionHeader}`);
      return new Response("Expected websocket", { status: 426 });
    }
    try {
      const stub = getGlobalStub(c);
      console.log(`[WS Proxy] Forwarding valid handshake to DO: ${stub.id.toString()}`);
      // Explicitly pass headers to preserve Upgrade header
      return await stub.fetch(c.req.raw.url, {
        method: c.req.raw.method,
        headers: c.req.raw.headers
      });
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
      console.error('[Diag Error] Returning fallback summary:', err);
      const fallback: DiagnosticSummary = {
        source: 'fallback',
        message: 'Durable Object logic core unresponsive',
        attempts: []
      };
      return c.json({ success: false, error: 'Logic core offline', detail: String(err), data: [] });
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