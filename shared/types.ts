export interface DemoItem {
  id: string;
  name: string;
  value: number;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface WsMessagePayload {
  id: string;
  text: string;
  clientTimestamp: number;
}
export interface EchoMessage extends WsMessagePayload {
  serverTimestamp: number;
  rtt?: number;
}
export interface WsAttempt {
  time: number;
  userAgent: string;
  origin: string;
  success: boolean;
}