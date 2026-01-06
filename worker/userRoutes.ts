import { Hono } from "hono";
import { Env } from './core-utils';
import type { DemoItem, ApiResponse } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'NexusEcho API' }}));
    app.get('/api/ws', async (c) => {
      console.log('[TRACE WS Worker] /api/ws GET received. Upgrade:', c.req.header('Upgrade') || 'MISSING');
      if ((c.req.header('upgrade') || '').toLowerCase() !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426);
      }
      const id = c.env.GlobalDurableObject.idFromName("global");
      const stub = c.env.GlobalDurableObject.get(id);
      console.log('[TRACE WS Worker] Upgrade OK, proxying to DO stub via fetch(c.req.raw). Env GlobalDurableObject available:', !!c.env.GlobalDurableObject);
      return stub.fetch(c.req.raw);
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