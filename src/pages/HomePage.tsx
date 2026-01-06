import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, Activity, Clock, Trash2, Bug, RefreshCw, Server, ArrowDown, Settings2 } from 'lucide-react';
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
import type { EchoMessage, WsMessagePayload, WsAttempt, ApiResponse, HealthResponse } from '@shared/types';
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
export function HomePage() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<EchoMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [diagAttempts, setDiagAttempts] = useState<WsAttempt[]>([]);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const isAtBottomRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
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
        toast.success('Nexus Node Connected');
      };
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        const arrivalTime = Date.now();
        try {
          const data = JSON.parse(event.data) as EchoMessage;
          const enrichedMessage: EchoMessage = {
            ...data,
            rtt: data.clientTimestamp > 0 ? Math.max(0, arrivalTime - data.clientTimestamp) : undefined
          };
          setMessages((prev) => [...prev, enrichedMessage]);
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
        if (!event.wasClean && autoReconnect && reconnectCount < MAX_RECONNECT_ATTEMPTS) {
          const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectCount);
          setReconnectCount(prev => prev + 1);
          toast.info(`Connection lost. Retrying in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (!event.wasClean && reconnectCount >= MAX_RECONNECT_ATTEMPTS) {
          setStatus('error');
          toast.error('Maximum reconnection attempts reached.');
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
  }, [autoReconnect, reconnectCount]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);
  const fetchDiagnostics = async () => {
    setIsLoadingDiag(true);
    try {
      const res = await fetch('/api/ws-diag');
      const json = await res.json() as ApiResponse<WsAttempt[]>;
      if (isMountedRef.current && json.success && json.data) {
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
      const res = await fetch('/api/ws');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as HealthResponse;
      setHealthStatus(data);
      toast.success('Durable Object is reachable via HTTP');
    } catch (e) {
      console.error('DO Health Check failed', e);
      toast.error(`DO is unreachable`);
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
      toast.error('Transmission failed');
    }
  };
  const scrollToBottom = () => {
    if (scrollViewportRef.current) {
      const scrollElement = scrollViewportRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
      }
    }
    setShowNewMessageButton(false);
  };
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setShowNewMessageButton(false);
    }
  };
  useEffect(() => {
    if (isAtBottomRef.current && scrollViewportRef.current) {
      const scrollElement = scrollViewportRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12 min-h-screen flex flex-col space-y-8 relative">
        <ThemeToggle />
        <div className="absolute inset-0 bg-radial-gradient-subtle pointer-events-none -z-10" />
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-accent-primary/10 rounded-2xl">
              <Activity className="w-10 h-10 text-accent-primary animate-pulse" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-foreground">
            Nexus<span className="text-accent-primary">Echo</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Resilient edge-native WebSocket telemetry powered by Cloudflare Durable Objects.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 shadow-soft border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Terminal</CardTitle>
                  <CardDescription>Infrastructure & Control</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
                    className={`px-3 py-1 capitalize transition-all ${status === 'connecting' ? 'animate-pulse' : ''}`}
                  >
                    {status === 'connecting' && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                    {status}
                  </Badge>
                  {reconnectCount > 0 && status !== 'connected' && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">
                      Retry {reconnectCount}/{MAX_RECONNECT_ATTEMPTS}
                    </span>
                  )}
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
                    aria-label="Toggle automatic reconnection"
                  />
                </div>
                <div className="flex gap-2">
                  {status === 'connected' ? (
                    <Button variant="outline" className="w-full" onClick={disconnect}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white"
                      onClick={connect}
                      disabled={status === 'connecting'}
                    >
                      {status === 'connecting' ? 'Negotiating...' : 'Connect to Node'}
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="icon" onClick={fetchDiagnostics}>
                        <Bug className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Server className="w-5 h-5 text-accent-primary" />
                          Infrastructure Diagnostics
                        </DialogTitle>
                        <DialogDescription>Verify DO reachability and handshake history.</DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">Durable Object Health</p>
                            <p className="text-xs text-muted-foreground">
                              {healthStatus ? `ID: ${healthStatus.doId.slice(0, 8)}...` : 'Status unknown'}
                            </p>
                          </div>
                          <Button size="sm" onClick={checkDoHealth} className="gap-2">
                            <Activity className="w-3 h-3" /> Check Path
                          </Button>
                        </div>
                        <Separator />
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Handshakes</p>
                        <ScrollArea className="h-[250px] pr-4">
                          <div className="space-y-3">
                            {isLoadingDiag ? (
                              <div className="py-10 flex justify-center"><Activity className="animate-spin text-accent-primary" /></div>
                            ) : diagAttempts.length === 0 ? (
                              <p className="text-center py-10 text-muted-foreground text-sm italic">No logs found</p>
                            ) : (
                              diagAttempts.map((attempt, i) => (
                                <div key={`${attempt.time}-${i}`} className="p-3 rounded border text-xs bg-secondary/10">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-mono">{new Date(attempt.time).toLocaleTimeString()}</span>
                                    <Badge variant={attempt.success ? "default" : "destructive"} className="text-[10px]">
                                      {attempt.success ? "Handshake Success" : "Failed"}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate">{attempt.userAgent}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <Separator />
              <form onSubmit={sendMessage} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="msg-input" className="text-sm font-medium text-foreground px-1">Message Stream</Label>
                  <Input
                    id="msg-input"
                    placeholder={status === 'connected' ? "Type a message..." : "Socket offline"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                    className="bg-secondary/30 h-12 focus-visible:ring-accent-primary"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status !== 'connected' || !inputText.trim()}
                  className="w-full h-12 text-base transition-all active:scale-[0.98]"
                >
                  <Send className="w-4 h-4 mr-2" /> Emit Pulse
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-7 shadow-soft border-border/50 flex flex-col h-[600px] overflow-hidden bg-card/50 backdrop-blur-sm relative">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 border-b bg-card/50">
              <div>
                <CardTitle className="text-2xl">Echo Stream</CardTitle>
                <CardDescription>Real-time edge telemetry</CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMessages([])}
                      disabled={messages.length === 0}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Stream</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden relative">
              <ScrollArea
                className="h-full px-6"
                ref={scrollViewportRef}
                onScrollCapture={handleScroll}
              >
                <div className="space-y-4 py-6">
                  {messages.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Clock className="w-12 h-12 opacity-10" />
                      <p className="text-sm font-medium opacity-50">Listening for pulses...</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="group flex flex-col space-y-1 animate-scale-in">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium tracking-tight">{msg.text}</span>
                          {msg.rtt !== undefined && (
                            <Badge variant="outline" className="font-mono text-[10px] bg-accent-primary/5 text-accent-primary border-accent-primary/20 shadow-sm">
                              {msg.rtt}ms RTT
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground opacity-60">
                          {msg.clientTimestamp > 0 && <span>Sent: {new Date(msg.clientTimestamp).toLocaleTimeString()}</span>}
                          <span>Received: {new Date(msg.serverTimestamp).toLocaleTimeString()}</span>
                        </div>
                        <Separator className="mt-2 opacity-30 group-last:hidden" />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {showNewMessageButton && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
                  <Button
                    size="sm"
                    className="rounded-full shadow-lg bg-accent-primary text-white gap-2 px-4 h-8"
                    onClick={scrollToBottom}
                  >
                    <ArrowDown className="w-3 h-3" />
                    New Messages
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <footer className="pt-12 pb-6 text-center text-muted-foreground/30 text-[10px] tracking-[0.2em] uppercase font-mono">
          NEXUS ECHO v2.6 �� INFRASTRUCTURE TELEMETRY ACTIVE
        </footer>
      </div>
    </div>
  );
}