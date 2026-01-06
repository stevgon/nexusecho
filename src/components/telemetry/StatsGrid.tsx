import React, { useMemo } from 'react';
import { Clock, Zap, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EchoMessage } from '@shared/types';
interface StatsGridProps {
  messages: EchoMessage[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionTotal: number;
}
export const StatsGrid: React.FC<StatsGridProps> = ({ messages, status, sessionTotal }) => {
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let peak = 0;
    let diffSum = 0;
    // Single pass for efficiency
    for (let i = 0; i < messages.length; i++) {
      const rtt = messages[i].rtt;
      if (rtt !== undefined && rtt > 0) {
        sum += rtt;
        count++;
        if (rtt > peak) peak = rtt;
      }
    }
    if (count === 0) {
      return { avg: 0, jitter: 0, peak: 0, bufferSize: messages.length };
    }
    const avg = sum / count;
    // Second pass for jitter (mean absolute deviation)
    for (let i = 0; i < messages.length; i++) {
      const rtt = messages[i].rtt;
      if (rtt !== undefined && rtt > 0) {
        diffSum += Math.abs(rtt - avg);
      }
    }
    return {
      avg: Math.round(avg),
      jitter: Math.round(diffSum / count),
      peak: Math.round(peak),
      bufferSize: messages.length,
    };
  }, [messages]);
  const metrics = [
    {
      label: 'Avg. Latency',
      value: `${stats.avg}ms`,
      icon: Clock,
      color: 'text-blue-500',
      description: `Peak: ${stats.peak}ms`,
    },
    {
      label: 'Network Jitter',
      value: `${stats.jitter}ms`,
      icon: Activity,
      color: 'text-purple-500',
      description: 'RTT Variance',
    },
    {
      label: 'Total Traffic',
      value: sessionTotal.toLocaleString(),
      icon: Zap,
      color: 'text-amber-500',
      description: `Buffer: ${stats.bufferSize} frames`,
      live: status === 'connected',
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 w-full animate-fade-in [animation-duration:400ms]">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden group hover:border-accent-primary/50 transition-all duration-300">
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
            <div className="space-y-0.5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{metric.label}</h3>
              <p className="text-3xl font-mono font-bold tracking-tight text-foreground">
                {metric.value}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground/60">{metric.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};