import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, WifiOff, Activity, Clock, Trash2, Bug, CheckCircle2, XCircle, Info } from 'lucide-react';
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
import type { EchoMessage, WsMessagePayload, WsAttempt, ApiResponse } from '@shared/types';
export function HomePage() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<EchoMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [diagAttempts, setDiagAttempts] = useState<WsAttempt[]>([]);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchDiagnostics = async () => {
    setIsLoadingDiag(true);
    try {
      const res = await fetch('/api/ws-diag');
      const json = await res.json() as ApiResponse<WsAttempt[]>;
      if (json.success && json.data) {
        setDiagAttempts(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch diagnostics', e);
      toast.error('Failed to load connection history');
    } finally {
      setIsLoadingDiag(false);
    }
  };
  const connect = useCallback(() => {
    if (wsRef.current) return;
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    console.group('WebSocket Connection Initialization');
    console.log('Target URL:', wsUrl);
    console.log('Timestamp:', new Date().toISOString());
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = (ev) => {
        console.groupCollapsed('WebSocket Event: Open');
        console.log('ReadyState:', ws.readyState);
        console.log('Event Details:', ev);
        console.groupEnd();
        setStatus('connected');
        toast.success('Connected to NexusEcho Node');
      };
      ws.onmessage = (event) => {
        const arrivalTime = Date.now();
        console.groupCollapsed('WebSocket Event: Message Received');
        console.log('Arrival Time:', arrivalTime);
        console.log('Raw Data:', event.data);
        try {
          const data = JSON.parse(event.data) as EchoMessage;
          const calculatedRtt = arrivalTime - data.clientTimestamp;
          console.log('Calculated RTT:', calculatedRtt, 'ms');
          const enrichedMessage: EchoMessage = {
            ...data,
            rtt: calculatedRtt > 0 ? calculatedRtt : 0
          };
          setMessages((prev) => [...prev, enrichedMessage]);
        } catch (e) {
          console.error('Parse Error:', e);
        }
        console.groupEnd();
      };
      ws.onclose = (ev) => {
        console.groupCollapsed('WebSocket Event: Close');
        console.log('Code:', ev.code, 'Reason:', ev.reason);
        console.log('WasClean:', ev.wasClean);
        console.groupEnd();
        setStatus('disconnected');
        wsRef.current = null;
      };
      ws.onerror = (ev) => {
        console.group('WebSocket Event: Error');
        console.error('WebSocket Error details:', ev);
        console.groupEnd();
        setStatus('error');
        toast.error('WebSocket connection error');
        wsRef.current = null;
      };
      wsRef.current = ws;
    } catch (e) {
      setStatus('error');
      console.error('Handshake Exception:', e);
      wsRef.current = null;
    }
    console.groupEnd();
  }, []);
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.close();
      setStatus('disconnected');
      toast.info('Disconnected from server');
    }
  }, []);
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
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
      console.error('Failed to send message', error);
      toast.error('Failed to send message');
    }
  };
  const clearLogs = () => {
    setMessages([]);
    toast.info('Message logs cleared');
  };
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
            High-precision real-time diagnostics powered by Cloudflare Durable Objects.
            Detailed connection insights and edge network latency monitoring.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-5 shadow-soft border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Control Center</CardTitle>
                  <CardDescription>Handshake & Diagnostic tools</CardDescription>
                </div>
                <Badge
                  variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
                  className="px-3 py-1 capitalize"
                >
                  {status === 'connected' && <Wifi className="w-3 h-3 mr-2" />}
                  {status === 'disconnected' && <WifiOff className="w-3 h-3 mr-2" />}
                  {status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                {status === 'connected' ? (
                  <Button variant="outline" className="w-full" onClick={disconnect}>
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white shadow-md transition-all active:scale-[0.98]"
                    onClick={connect}
                    disabled={status === 'connecting'}
                  >
                    {status === 'connecting' ? 'Establishing Handshake...' : 'Initiate Connection'}
                  </Button>
                )}
                {(status === 'disconnected' || status === 'error') && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="icon" onClick={fetchDiagnostics} title="View Diagnostics">
                        <Bug className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Connection Diagnostics</DialogTitle>
                        <DialogDescription>
                          Recent handshake attempts recorded on the Durable Object (Edge Storage).
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[400px] mt-4 pr-4">
                        <div className="space-y-4">
                          {isLoadingDiag ? (
                            <div className="flex items-center justify-center py-8">
                              <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          ) : diagAttempts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              No connection history found.
                            </div>
                          ) : (
                            diagAttempts.map((attempt, i) => (
                              <div key={i} className="flex flex-col p-3 rounded-lg border bg-secondary/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {new Date(attempt.time).toLocaleString()}
                                  </span>
                                  <Badge variant={attempt.success ? "default" : "destructive"} className="gap-1">
                                    {attempt.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {attempt.success ? "Established" : "Failed"}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-start gap-2 text-xs">
                                    <Info className="h-3 w-3 mt-0.5 text-accent-primary" />
                                    <span className="font-medium">Origin:</span>
                                    <span className="text-muted-foreground truncate">{attempt.origin}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground leading-tight italic">
                                    {attempt.userAgent}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Separator />
              <form onSubmit={sendMessage} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground px-1">Message Payload</label>
                  <Input
                    placeholder={status === 'connected' ? "Type a message..." : "Handshake required"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                    className="bg-secondary/30 border-input h-12 focus:ring-accent-primary"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status !== 'connected' || !inputText.trim()}
                  className="w-full flex items-center justify-center gap-2 h-12 text-base font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  Echo Pulse
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-7 shadow-soft border-border/50 flex flex-col h-[500px] md:h-[600px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-2xl">Echo Stream</CardTitle>
                <CardDescription>Live telemetry from the edge</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={clearLogs} disabled={messages.length === 0}>
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-6">
                <div className="space-y-4 py-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Clock className="w-12 h-12 opacity-10" />
                      <p className="text-sm">No pulse data detected.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="group flex flex-col space-y-1 animate-scale-in">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{msg.text}</span>
                          <Badge variant="outline" className="font-mono text-[10px] bg-accent-primary/5 border-accent-primary/20 text-accent-primary">
                            {msg.rtt ?? 0}ms RTT
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity">
                          <span>Handshake: {new Date(msg.clientTimestamp).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>Edge Response: {new Date(msg.serverTimestamp).toLocaleTimeString()}</span>
                        </div>
                        <Separator className="mt-2 opacity-30" />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <footer className="pt-12 pb-6 text-center text-muted-foreground/40 text-xs tracking-wide">
          <p>NEXUS ECHO v2.0 • BUILT ON CLOUDFLARE DURABLE OBJECTS • PRECISION MEASUREMENT ACTIVE</p>
        </footer>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}