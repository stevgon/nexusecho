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
  const formatOptions: Intl.DateTimeFormatOptions = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  return (
    <div className="group flex flex-col space-y-0.5 animate-scale-in hover:bg-accent/5 p-2 rounded-lg transition-colors">
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
              "font-mono text-[10px] shadow-sm whitespace-nowrap px-1.5 h-5",
              msg.rtt < 50 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
              msg.rtt < 150 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
              "bg-destructive/10 text-destructive border-destructive/20"
            )}
          >
            {msg.rtt}ms
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 font-mono">
        {msg.clientTimestamp > 0 && (
          <span className="flex items-center gap-1 opacity-70">
            TX: {new Date(msg.clientTimestamp).toLocaleTimeString([], formatOptions)}
          </span>
        )}
        <span className="flex items-center gap-1 opacity-70">
          RX: {new Date(msg.serverTimestamp).toLocaleTimeString([], formatOptions)}
        </span>
      </div>
      <Separator className="mt-2 opacity-20 group-last:hidden" />
    </div>
  );
});
MessageItem.displayName = 'MessageItem';