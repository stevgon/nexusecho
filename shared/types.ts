export interface DemoItem {
  id: string;
  name: string;
  value: number;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  detail?: string;
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
  error?: string;
  stage?: string;
  headers?: Record<string, string>;
}
/**
 * Response interface for the dedicated /api/health-do endpoint
 */
export interface HealthResponse {
  status: string;
  timestamp: number;
  doId: string;
  usage: string;
  protocol?: string;
}
/**
 * High-level infrastructure status response
 */
export interface WorkerStatusResponse {
  binding: 'available' | 'missing';
  stub: 'created' | 'failed';
  doLogic: 'reachable' | 'unreachable';
  userRoutesLoaded: boolean;
  timestamp: string;
  details?: string;
}
/**
 * Fallback diagnostic summary when DO is unreachable
 */
export interface DiagnosticSummary {
  source: 'cache' | 'fallback';
  message: string;
  attempts: WsAttempt[];
}