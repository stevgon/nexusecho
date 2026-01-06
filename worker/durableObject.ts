import { DurableObject } from "cloudflare:workers";
import type { DemoItem, WsMessagePayload, EchoMessage } from '@shared/types';
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
    async fetch(request: Request): Promise<Response> {
      const upgradeHeader = request.headers.get('Upgrade') ?? '';
      if (!upgradeHeader.toLowerCase().startsWith('websocket')) {
        return new Response('Expected websocket', { status: 400 });
      }
      const webSocketPair = new WebSocketPair();
      const client = webSocketPair[0];
      const server = webSocketPair[1];
      server.addEventListener("message", (event) => {
        console.log(`DO: Received WS message data type: ${typeof event.data}, length: ${event.data?.length || 0}`);
        try {
          const payload = JSON.parse(event.data as string) as WsMessagePayload;
          console.log(`DO: Echo sent for ID ${payload.id} payload:`, payload);
          const echoResponse: EchoMessage = {
            ...payload,
            serverTimestamp: Date.now()
          };
          server.send(JSON.stringify(echoResponse));
        } catch (error) {
          console.error("Failed to process WS message", error);
        }
      });
      console.log('DO: WebSocket pair established');
      return new Response(null, { status: 101, webSocket: client });
    }
}