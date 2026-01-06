import { DurableObject } from "cloudflare:workers";
import type { DemoItem, WsMessagePayload, EchoMessage, WsAttempt } from '@shared/types';
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
    async recordWsAttempt(userAgent: string, origin: string): Promise<void> {
      const attempts = await this.getWsAttempts();
      const newAttempt: WsAttempt = {
        time: Date.now(),
        userAgent,
        origin,
        success: false
      };
      // Keep only 10 most recent entries
      const updated = [newAttempt, ...attempts].slice(0, 10);
      await this.ctx.storage.put("ws_attempts", updated);
    }
    async markLatestAttemptSuccess(): Promise<void> {
      const attempts = await this.getWsAttempts();
      if (attempts.length > 0 && !attempts[0].success) {
        attempts[0].success = true;
        await this.ctx.storage.put("ws_attempts", attempts);
      }
    }
    async fetch(request: Request): Promise<Response> {
      const upgradeHeader = request.headers.get('Upgrade') ?? '';
      if (!upgradeHeader.toLowerCase().startsWith('websocket')) {
        return new Response('Expected websocket', { status: 400 });
      }
      // Record diagnostic attempt
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      const origin = request.headers.get('Origin') || 'unknown';
      await this.recordWsAttempt(userAgent, origin);
      const webSocketPair = new WebSocketPair();
      const client = webSocketPair[0];
      const server = webSocketPair[1];
      server.addEventListener("message", async (event) => {
        try {
          const payload = JSON.parse(event.data as string) as WsMessagePayload;
          const echoResponse: EchoMessage = {
            ...payload,
            serverTimestamp: Date.now()
          };
          server.send(JSON.stringify(echoResponse));
          // Mark success on first successful echo
          await this.markLatestAttemptSuccess();
        } catch (error) {
          console.error("Failed to process WS message", error);
        }
      });
      server.addEventListener('open', () => {
        const connectedMsg: EchoMessage = {
          id: 'server-connected',
          text: 'DO connected',
          clientTimestamp: 0,
          serverTimestamp: Date.now()
        };
        server.send(JSON.stringify(connectedMsg));
      });
      try {
        server.accept();
      } catch (error) {
        console.error('Failed to accept server WS:', error);
        return new Response('WebSocket setup failed', { status: 500 });
      }
      return new Response(null, { status: 101, webSocket: client });
    }
}