import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Wifi, WifiOff, Activity, Clock, Trash2 } from 'lucide-react';
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
import type { EchoMessage, WsMessagePayload } from '@shared/types';
export function HomePage() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<EchoMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const connect = useCallback(() => {
    if (wsRef.current) return;
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setStatus('connected');
        toast.success('Connected to NexusEcho Node');
      };
      ws.onmessage = (event) => {
        // High-precision arrival time capture
        const arrivalTime = Date.now();
        try {
          const data = JSON.parse(event.data) as EchoMessage;
          // Calculate RTT immediately to avoid React render delays or browser task scheduling noise
          const calculatedRtt = arrivalTime - data.clientTimestamp;
          const enrichedMessage: EchoMessage = {
            ...data,
            rtt: calculatedRtt > 0 ? calculatedRtt : 0
          };
          setMessages((prev) => [...prev, enrichedMessage]);
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      };
      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;
      };
      ws.onerror = () => {
        setStatus('error');
        toast.error('WebSocket connection error');
      };
      wsRef.current = ws;
    } catch (e) {
      setStatus('error');
      console.error(e);
    }
  }, []);
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus('disconnected');
      toast.info('Disconnected from server');
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
    wsRef.current.send(JSON.stringify(payload));
    setInputText('');
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
        {/* Header Section */}
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
            High-precision real-time echo service powered by Cloudflare Durable Objects.
            Monitor edge network latency with millisecond accuracy.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interaction Area */}
          <Card className="lg:col-span-5 shadow-soft border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Control Center</CardTitle>
                  <CardDescription>Manage connection and send pulses</CardDescription>
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
                    className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white"
                    onClick={connect}
                    disabled={status === 'connecting'}
                  >
                    {status === 'connecting' ? 'Connecting...' : 'Connect to Node'}
                  </Button>
                )}
              </div>
              <Separator />
              <form onSubmit={sendMessage} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground px-1">Message Payload</label>
                  <Input
                    placeholder={status === 'connected' ? "Type a message..." : "Connect to send messages"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                    className="bg-secondary/50 border-input h-12"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status !== 'connected' || !inputText.trim()}
                  className="w-full flex items-center justify-center gap-2 h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  Send Pulse
                </Button>
              </form>
            </CardContent>
          </Card>
          {/* Logs Area */}
          <Card className="lg:col-span-7 shadow-soft border-border/50 flex flex-col h-[500px] md:h-[600px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-2xl">Live Echo Stream</CardTitle>
                <CardDescription>Precision RTT measurements (Pre-computed)</CardDescription>
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
                      <Clock className="w-12 h-12 opacity-20" />
                      <p>Waiting for pulses...</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="flex flex-col space-y-1 animate-scale-in">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{msg.text}</span>
                          <Badge variant="outline" className="font-mono text-2xs bg-accent-primary/5 border-accent-primary/20 text-accent-primary">
                            {msg.rtt ?? 0}ms RTT
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>Client sent: {new Date(msg.clientTimestamp).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>Server echo: {new Date(msg.serverTimestamp).toLocaleTimeString()}</span>
                        </div>
                        <Separator className="mt-2 opacity-50" />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <footer className="pt-12 pb-6 text-center text-muted-foreground/60 text-sm">
          <p>Powered by Cloudflare Workers & Durable Objects • Accuracy: ±1ms</p>
        </footer>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}