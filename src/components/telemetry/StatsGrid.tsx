import React, { useMemo } from 'react';
import { Clock, Zap, Activity, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EchoMessage } from '@shared/types';
interface StatsGridProps {
  messages: EchoMessage[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}
export const StatsGrid: React.FC<StatsGridProps> = ({ messages, status }) => {
  const stats = useMemo(() => {
    const validRtts = messages
      .map((m) => m.rtt)
      .filter((rtt): rtt is number => rtt !== undefined && rtt > 0);
    if (validRtts.length === 0) {
      return { avg: 0, jitter: 0, peak: 0, total: messages.length };
    }
    const sum = validRtts.reduce((a, b) => a + b, 0);
    const avg = sum / validRtts.length;
    const peak = Math.max(...validRtts);
    // Jitter calculation (Mean Absolute Deviation of RTT)
    const jitter = validRtts.length > 1 
      ? validRtts.reduce((acc, val) => acc + Math.abs(val - avg), 0) / validRtts.length
      : 0;
    return {
      avg: Math.round(avg),
      jitter: Math.round(jitter),
      peak: Math.round(peak),
      total: messages.length,
    };
  }, [messages]);
  const metrics = [
    {
      label: 'Average Latency',
      value: `${stats.avg}ms`,
      icon: Clock,
      color: 'text-blue-500',
      description: 'Mean round-trip time',
    },
    {
      label: 'Network Jitter',
      value: `${stats.jitter}ms`,
      icon: Activity,
      color: 'text-purple-500',
      description: 'Latency variance',
    },
    {
      label: 'Data Packets',
      value: stats.total.toString(),
      icon: Zap,
      color: 'text-amber-500',
      description: 'Total echoes received',
      live: status === 'connected',
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 w-full animate-fade-in">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden group hover:border-accent-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg bg-secondary/50 ${metric.color}`}>
                <metric.icon className="w-5 h-5" />
              </div>
              {metric.live && (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-emerald-500">Live</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">{metric.label}</h3>
              <p className="text-3xl font-mono font-bold tracking-tight text-foreground">
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground/70">{metric.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};