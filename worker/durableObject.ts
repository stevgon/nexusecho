import { DurableObject } from "cloudflare:workers";
import type { DemoItem, WsMessagePayload, EchoMessage, WsAttempt, HealthResponse } from '@shared/types';
import { MOCK_ITEMS } from '@shared/mock-data';
export class GlobalDurableObject extends DurableObject {
  async getCounterValue(): Promise<number> {
    const value = (await this.ctx.storage.get("counter_value")) || 0;
    return value as number;
  }
  async increment(amount = 1): Promise<number> {
    let value: number = (await this.ctx.storage.get("counter_value")) || 0;
    value += amount;
    await this.ctx.storage.put("counter_value", value);
    return value;
  }
  async getDemoItems(): Promise<DemoItem[]> {
    const items = await this.ctx.storage.get("demo_items");
    if (items) return items as DemoItem[];
    await this.ctx.storage.put("demo_items", MOCK_ITEMS);
    return MOCK_ITEMS;
  }
  async addDemoItem(item: DemoItem): Promise<DemoItem[]> {
    const items = await this.getDemoItems();
    const updatedItems = [...items, item];
    await this.ctx.storage.put("demo_items", updatedItems);
    return updatedItems;
  }
  async updateDemoItem(id: string, updates: Partial<Omit<DemoItem, 'id'>>): Promise<DemoItem[]> {
    const items = await this.getDemoItems();
    const updatedItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
    await this.ctx.storage.put("demo_items", updatedItems);
    return updatedItems;
  }
  async deleteDemoItem(id: string): Promise<DemoItem[]> {
    const items = await this.getDemoItems();
    const updatedItems = items.filter(item => item.id !== id);
    await this.ctx.storage.put("demo_items", updatedItems);
    return updatedItems;
  }
  async getWsAttempts(): Promise<WsAttempt[]> {
    const attempts = await this.ctx.storage.get("ws_attempts");
    return (attempts as WsAttempt[]) || [];
  }
  async recordWsAttempt(userAgent: string, origin: string, error?: string, stage?: string): Promise<void> {
    const attempts = await this.getWsAttempts();
    const newAttempt: WsAttempt = {
      time: Date.now(),
      userAgent,
      origin,
      success: !error,
      error,
      stage
    };
    const updated = [newAttempt, ...attempts].slice(0, 15);
    await this.ctx.storage.put("ws_attempts", updated);
  }
  async markLatestAttemptSuccess(): Promise<void> {
    const attempts = await this.getWsAttempts();
    if (attempts.length > 0 && !attempts[0].success) {
      attempts[0].success = true;
      attempts[0].error = undefined;
      await this.ctx.storage.put("ws_attempts", attempts);
    }
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade') || '';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const origin = request.headers.get('Origin') || 'unknown';
    // Handle HTTP Health Checks
    if (!upgradeHeader.toLowerCase().includes('websocket')) {
      console.log(`[DO HTTP Request] Received standard request at ${url.pathname}`);
      const health: HealthResponse = {
        status: 'DO is reachable and active',
        timestamp: Date.now(),
        doId: this.ctx.id.toString(),
        usage: 'websocket_echo_node'
      };
      return new Response(JSON.stringify(health), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    console.log(`[DO WS Upgrade] Attempting handshake for ${userAgent}`);
    await this.recordWsAttempt(userAgent, origin, undefined, 'handshake_start');
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();
    console.log(`[DO WS Accepted] Connection accepted, setting up listeners`);
    server.addEventListener("message", async (event) => {
      try {
        const payload = JSON.parse(event.data as string) as WsMessagePayload;
        const echoResponse: EchoMessage = {
          ...payload,
          serverTimestamp: Date.now()
        };
        server.send(JSON.stringify(echoResponse));
        await this.markLatestAttemptSuccess();
      } catch (error) {
        console.error("[DO WS Message Error]", error);
      }
    });
    server.addEventListener("close", (cls) => {
      console.log(`[DO WS Closed] Code: ${cls.code}, Reason: ${cls.reason}`);
    });
    server.addEventListener("error", (err) => {
      console.error(`[DO WS Error]`, err);
    });
    // Send initial pulse with a slight delay to ensure client readiness
    setTimeout(() => {
      try {
        const connectedMsg: EchoMessage = {
          id: 'server-init',
          text: 'NexusEcho Node Online',
          clientTimestamp: 0,
          serverTimestamp: Date.now()
        };
        server.send(JSON.stringify(connectedMsg));
        console.log(`[DO WS Init] Sent welcome frame`);
      } catch (e) {
        console.warn(`[DO WS Init Failed] Client might have closed early`);
      }
    }, 50);
    return new Response(null, { status: 101, webSocket: client });
  }
}