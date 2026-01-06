import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, WifiOff, Activity, Clock, Trash2, Bug, CheckCircle2, XCircle, Info, RefreshCw, Server } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { EchoMessage, WsMessagePayload, WsAttempt, ApiResponse, HealthResponse } from '@shared/types';
export function HomePage() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<EchoMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [diagAttempts, setDiagAttempts] = useState<WsAttempt[]>([]);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
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
      const res = await fetch('/api/ws'); // HTTP GET to the WS endpoint triggers DO health check
      const data = await res.json() as HealthResponse;
      setHealthStatus(data);
      toast.success('Durable Object is reachable via HTTP');
    } catch (e) {
      console.error('DO Health Check failed', e);
      toast.error('DO is unreachable. Check Worker bindings.');
    }
  };
  const connect = useCallback(() => {
    if (wsRef.current) return;
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        setStatus('connected');
        toast.success('Handshake Successful');
      };
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        const arrivalTime = Date.now();
        try {
          const data = JSON.parse(event.data) as EchoMessage;
          let enrichedMessage: EchoMessage;
          if (data.clientTimestamp > 0) {
            enrichedMessage = { ...data, rtt: Math.max(0, arrivalTime - data.clientTimestamp) };
          } else {
            enrichedMessage = { ...data, rtt: undefined };
          }
          setMessages((prev) => [...prev, enrichedMessage]);
        } catch (e) {
          console.warn('Malformed WS frame', e);
        }
      };
      ws.onclose = (event) => {
        if (isMountedRef.current) {
          setStatus('disconnected');
          if (!event.wasClean) {
            toast.error(`Connection Refused (Code: ${event.code})`);
          }
        }
        wsRef.current = null;
      };
      ws.onerror = (ev) => {
        console.error('WS Socket Error:', ev);
        if (isMountedRef.current) {
          setStatus('error');
          toast.error('Handshake Refused. Check Diagnostics panel for protocol details.');
        }
        wsRef.current = null;
      };
      wsRef.current = ws;
    } catch (e) {
      console.error('Socket Instantiation Error:', e);
      setStatus('error');
      wsRef.current = null;
    }
  }, []);
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus('disconnected');
    }
  }, []);
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
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Edge-native WebSocket telemetry powered by Durable Objects.
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
                <Badge
                  variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
                  className={`px-3 py-1 capitalize ${status === 'connecting' ? 'animate-pulse' : ''}`}
                >
                  {status === 'connected' && <Wifi className="w-3 h-3 mr-2" />}
                  {status === 'connecting' && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                  {status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                {status === 'connected' ? (
                  <Button variant="outline" className="w-full" onClick={disconnect}>Disconnect</Button>
                ) : (
                  <Button
                    className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white shadow-md transition-all"
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
                            <div className="py-10 flex justify-center"><Activity className="animate-spin" /></div>
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
                                <p className="text-[10px] text-muted-foreground opacity-60 truncate mb-1">{attempt.userAgent}</p>
                                {attempt.error && <p className="text-destructive font-mono text-[9px] mt-1">Error: {attempt.error}</p>}
                                {attempt.stage && <p className="text-accent-primary text-[9px]">Stage: {attempt.stage}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Separator />
              <form onSubmit={sendMessage} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground px-1">Message Stream</label>
                  <Input
                    placeholder={status === 'connected' ? "Type a message..." : "Socket offline"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                    className="bg-secondary/30 h-12"
                  />
                </div>
                <Button type="submit" disabled={status !== 'connected' || !inputText.trim()} className="w-full h-12 text-base">
                  <Send className="w-4 h-4 mr-2" /> Emit Pulse
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-7 shadow-soft border-border/50 flex flex-col h-[600px] overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-2xl">Echo Stream</CardTitle>
                <CardDescription>Real-time edge telemetry</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMessages([])} disabled={messages.length === 0}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-6">
                <div className="space-y-4 py-4">
                  {messages.length === 0 ? (
                    <div className="h-[450px] flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Clock className="w-12 h-12 opacity-10" />
                      <p className="text-sm">Listening for pulses...</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="group flex flex-col space-y-1 animate-scale-in">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{msg.text}</span>
                          {msg.rtt !== undefined && (
                            <Badge variant="outline" className="font-mono text-[10px] bg-accent-primary/5 text-accent-primary border-accent-primary/20">
                              {msg.rtt}ms RTT
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground opacity-60">
                          {msg.clientTimestamp > 0 && <span>Sent: {new Date(msg.clientTimestamp).toLocaleTimeString()}</span>}
                          <span>Received: {new Date(msg.serverTimestamp).toLocaleTimeString()}</span>
                        </div>
                        <Separator className="mt-2 opacity-30" />
                      </div>
                    ))
                  )}
                  <div ref={scrollAnchorRef} className="h-px" />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <footer className="pt-12 pb-6 text-center text-muted-foreground/30 text-xs tracking-widest uppercase">
          NEXUS ECHO v2.5 • INFRASTRUCTURE DIAGNOSTICS ACTIVE
        </footer>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}