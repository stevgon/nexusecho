import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { EchoMessage } from '@shared/types';
import { cn } from '@/lib/utils';
interface MessageItemProps {
  msg: EchoMessage;
}
export const MessageItem: React.FC<MessageItemProps> = React.memo(({ msg }) => {
  const isServerInit = msg.id === 'server-init';
  return (
    <div className="group flex flex-col space-y-1 animate-scale-in hover:bg-accent/5 p-2 rounded-lg transition-colors">
      <div className="flex items-center justify-between gap-4">
        <span className={cn(
          "text-sm font-medium tracking-tight text-pretty transition-colors",
          isServerInit ? "text-accent-primary italic" : "text-foreground"
        )}>
          {msg.text}
        </span>
        {msg.rtt !== undefined && (
          <Badge 
            variant="outline" 
            className={cn(
              "font-mono text-[10px] shadow-sm whitespace-nowrap",
              msg.rtt < 50 ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" :
              msg.rtt < 150 ? "bg-amber-500/5 text-amber-500 border-amber-500/20" :
              "bg-destructive/5 text-destructive border-destructive/20"
            )}
          >
            {msg.rtt}ms RTT
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
        {msg.clientTimestamp > 0 && (
          <span className="flex items-center gap-1">
            Tx: {new Date(msg.clientTimestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 } as any)}
          </span>
        )}
        <span className="flex items-center gap-1">
          Rx: {new Date(msg.serverTimestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 } as any)}
        </span>
      </div>
      <Separator className="mt-2 opacity-30 group-last:hidden" />
    </div>
  );
});
MessageItem.displayName = 'MessageItem';