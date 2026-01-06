import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Activity, Trash2, Bug, RefreshCw, Server, ArrowDown, Settings2, Network, ShieldCheck, Terminal } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatsGrid } from '@/components/telemetry/StatsGrid';
import { MessageItem } from '@/components/telemetry/MessageItem';
import type { EchoMessage, WsMessagePayload, WsAttempt, ApiResponse, HealthResponse, WorkerStatusResponse } from '@shared/types';
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_HISTORY_LIMIT = 200;
export function HomePage() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<EchoMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [diagAttempts, setDiagAttempts] = useState<WsAttempt[]>([]);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatusResponse | null>(null);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const isAtBottomRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const getViewport = useCallback(() => {
    return scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
  }, []);
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);
  const connect = useCallback(() => {
    if (wsRef.current || !isMountedRef.current) return;
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setStatus('connected');
        setReconnectCount(0);
        toast.success('Infrastructure Uplink Active');
      };
      ws.onmessage = (event) => {
        const arrivalTime = Date.now();
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as EchoMessage;
          const enrichedMessage: EchoMessage = {
            ...data,
            rtt: data.clientTimestamp > 0 ? Math.max(0, arrivalTime - data.clientTimestamp) : undefined
          };
          setMessages((prev) => {
            const next = [...prev, enrichedMessage];
            return next.length > MAX_HISTORY_LIMIT ? next.slice(-MAX_HISTORY_LIMIT) : next;
          });
          if (!isAtBottomRef.current) {
            setShowNewMessageButton(true);
          }
        } catch (e) {
          console.warn('Malformed WS frame', e);
        }
      };
      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        wsRef.current = null;
        setStatus('disconnected');
        if (!event.wasClean && autoReconnect) {
          setReconnectCount((count) => {
            if (count < MAX_RECONNECT_ATTEMPTS) {
              const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, count);
              toast.info(`Link lost. Re-establishing in ${delay}ms...`);
              reconnectTimeoutRef.current = setTimeout(() => {
                connect();
              }, delay);
              return count + 1;
            } else {
              setStatus('error');
              toast.error('Critical: Maximum handshake attempts exceeded');
              return count;
            }
          });
        }
      };
      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setStatus('error');
      };
    } catch (e) {
      console.error('Socket Instantiation Error:', e);
      setStatus('error');
      wsRef.current = null;
    }
  }, [autoReconnect]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);
  const fetchWorkerStatus = async () => {
    try {
      const res = await fetch('/api/worker-status');
      const data = await res.json() as WorkerStatusResponse;
      setWorkerStatus(data);
    } catch (e) {
      console.error('Worker status check failed', e);
    }
  };
  const fetchDiagnostics = async () => {
    setIsLoadingDiag(true);
    fetchWorkerStatus();
    try {
      const res = await fetch('/api/ws-diag');
      const json = await res.json() as ApiResponse<WsAttempt[]>;
      if (isMountedRef.current && json.data) {
        setDiagAttempts(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch diagnostics', e);
    } finally {
      if (isMountedRef.current) setIsLoadingDiag(false);
    }
  };
  const checkDoHealth = async () => {
    try {
      const res = await fetch('/api/health-do');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as HealthResponse;
      setHealthStatus(data);
      toast.success('Durable Object Control Plane Reachable');
    } catch (e) {
      console.error('DO Health Check failed', e);
      toast.error(`Control Plane Unreachable`);
    }
  };
  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || status !== 'connected' || !wsRef.current) return;
    const payload: WsMessagePayload = {
      id: uuidv4(),
      text: inputText.trim(),
      clientTimestamp: Date.now(),
    };
    try {
      wsRef.current.send(JSON.stringify(payload));
      setInputText('');
    } catch (error) {
      toast.error('Frame transmission failed');
    }
  };
  const scrollToBottom = () => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
    setShowNewMessageButton(false);
    isAtBottomRef.current = true;
  };
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 50;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + threshold;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom && showNewMessageButton) {
      setShowNewMessageButton(false);
    }
  };
  useEffect(() => {
    if (isAtBottomRef.current) {
      const viewport = getViewport();
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, getViewport]);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 min-h-screen flex flex-col space-y-8 relative">
        <ThemeToggle />
        <div className="absolute inset-0 bg-radial-gradient-subtle pointer-events-none -z-10" />
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-accent-primary/10 rounded-2xl relative">
              <Network className="w-10 h-10 text-accent-primary animate-pulse" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-background animate-bounce" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-foreground">
            Nexus<span className="text-accent-primary">Echo</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Professional-grade WebSocket telemetry and observability layer.
          </p>
        </div>
        <StatsGrid messages={messages} status={status} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 shadow-soft border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Control Center</CardTitle>
                  <CardDescription>Handshake & Uplink Management</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
                    className={`px-3 py-1 capitalize transition-all ${status === 'connecting' ? 'animate-pulse' : ''}`}
                  >
                    {status === 'connecting' && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                    {status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="auto-reconnect" className="text-sm font-medium cursor-pointer">Auto-Reconnect</Label>
                  </div>
                  <Switch
                    id="auto-reconnect"
                    checked={autoReconnect}
                    onCheckedChange={setAutoReconnect}
                  />
                </div>
                <div className="flex gap-2">
                  {status === 'connected' ? (
                    <Button variant="outline" className="w-full" onClick={disconnect}>
                      Terminate Link
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white shadow-lg shadow-accent-primary/20"
                      onClick={connect}
                      disabled={status === 'connecting'}
                    >
                      {status === 'connecting' ? 'Negotiating handshake...' : 'Initialize Uplink'}
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="icon" onClick={fetchDiagnostics}>
                        <Bug className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-accent-primary" />
                          Diagnostic Console v4
                        </DialogTitle>
                        <DialogDescription>Infrastructure health and audit logs for low-level debugging.</DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                        {/* System Health Section */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3" /> System Overview
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border bg-secondary/10 space-y-1">
                              <p className="text-xs text-muted-foreground">Binding Status</p>
                              <Badge variant={workerStatus?.binding === 'available' ? 'default' : 'destructive'} className="text-[9px]">
                                {workerStatus?.binding || 'unknown'}
                              </Badge>
                            </div>
                            <div className="p-3 rounded-lg border bg-secondary/10 space-y-1">
                              <p className="text-xs text-muted-foreground">Logic Core</p>
                              <Badge variant={workerStatus?.doLogic === 'reachable' ? 'default' : 'destructive'} className="text-[9px]">
                                {workerStatus?.doLogic || 'checking...'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">Control Plane Link</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {healthStatus ? `DO_ID: ${healthStatus.doId.slice(0, 16)}...` : 'Path verification required'}
                            </p>
                          </div>
                          <Button size="sm" onClick={checkDoHealth} className="gap-2">
                            <Activity className="w-3 h-3" /> Verify Path
                          </Button>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Handshake Audit Log</p>
                          <ScrollArea className="h-[300px] rounded-md border bg-black/[0.02] p-2">
                            <div className="space-y-3">
                              {isLoadingDiag ? (
                                <div className="py-20 flex justify-center"><Activity className="animate-spin text-accent-primary" /></div>
                              ) : diagAttempts.length === 0 ? (
                                <p className="text-center py-20 text-muted-foreground text-sm italic">No audit records found in current DO epoch</p>
                              ) : (
                                diagAttempts.map((attempt, i) => (
                                  <div key={`${attempt.time}-${i}`} className="p-3 rounded border text-xs bg-card group transition-colors hover:border-accent-primary/30">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-mono text-[10px] text-muted-foreground">{new Date(attempt.time).toLocaleTimeString()}</span>
                                      <Badge variant={attempt.success ? "default" : "destructive"} className="text-[8px] uppercase">
                                        {attempt.stage || (attempt.success ? "Success" : "Failed")}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2 font-mono bg-secondary/30 p-1 rounded">
                                      {attempt.userAgent}
                                    </p>
                                    {attempt.headers && (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Runtime Metadata:</p>
                                        <pre className="text-[9px] bg-secondary/50 p-2 rounded overflow-x-auto font-mono text-accent-primary/80">
                                          {JSON.stringify(attempt.headers, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <Separator />
              <form onSubmit={sendMessage} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="msg-input" className="text-sm font-medium text-foreground px-1">Telemetry Pulse</Label>
                  <Input
                    id="msg-input"
                    placeholder={status === 'connected' ? "Enter payload data..." : "Uplink offline"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                    className="bg-secondary/30 h-12 focus-visible:ring-accent-primary border-none shadow-inner"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status !== 'connected' || !inputText.trim()}
                  className="w-full h-12 text-base transition-all active:scale-[0.98] bg-foreground text-background hover:bg-foreground/90"
                >
                  <Send className="w-4 h-4 mr-2" /> Emit Frame
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-7 shadow-soft border-border/50 flex flex-col h-[650px] overflow-hidden bg-card/50 backdrop-blur-sm relative">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 border-b bg-card/50">
              <div>
                <CardTitle className="text-2xl">Telemetry Feed</CardTitle>
                <CardDescription>Live edge-to-client stream</CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMessages([])}
                      disabled={messages.length === 0}
                      className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Purge Data Feed</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden relative">
              <ScrollArea
                className="h-full px-6"
                ref={scrollViewportRef}
                onScrollCapture={handleScroll}
              >
                <div className="space-y-2 py-6">
                  {messages.length === 0 ? (
                    <div className="h-[450px] flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Activity className="w-12 h-12 opacity-10 animate-pulse" />
                      <p className="text-sm font-medium opacity-50 tracking-widest uppercase">Awaiting Data Pulse...</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageItem key={msg.id} msg={msg} />
                    ))
                  )}
                </div>
              </ScrollArea>
              {showNewMessageButton && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <Button
                    size="sm"
                    className="rounded-full shadow-2xl bg-accent-primary text-white gap-2 px-6 h-10 hover:scale-105 active:scale-95 transition-all"
                    onClick={scrollToBottom}
                  >
                    <ArrowDown className="w-4 h-4 animate-bounce" />
                    Unread Packets
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <footer className="pt-16 pb-8 text-center space-y-2">
          <div className="text-muted-foreground/30 text-[10px] tracking-[0.3em] uppercase font-mono">
            NEXUS ECHO v4.0 // OBSERVABILITY ENABLED
          </div>
          <div className="text-muted-foreground/20 text-[8px] font-mono">
            PROVISIONED BY CLOUDFLARE WORKERS & DURABLE OBJECTS
          </div>
        </footer>
      </div>
    </div>
  );
}