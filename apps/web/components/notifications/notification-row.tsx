"use client";

import { X } from "lucide-react";
import type { NotificationItem } from "swiftgoma-mp-notifications";

import { formatRelative } from "@/components/dashboard/format-date";
import { CONTEXT_META } from "@/components/notifications/notification-meta";
import { cn } from "cn";

interface NotificationRowProps {
  item: NotificationItem;
  onRead: (id: string) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
}

export function NotificationRow({ item, onRead, onRemove, compact }: NotificationRowProps) {
  const { icon: Icon, label } = CONTEXT_META[item.context];
  const unread = item.readAt === null;
  const important = item.priority === "HIGH" || item.priority === "CRITICAL";

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 transition-colors",
        compact ? "px-4 py-3 hover:bg-muted/50" : "rounded-xl border bg-card p-4",
        unread && !compact && "border-primary/30",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          important ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <button
        type="button"
        onClick={() => unread && onRead(item.id)}
        className={cn(
          "grid min-w-0 flex-1 gap-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          unread ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {item.title}
          </span>
          {unread && (
            <span aria-label="Non lue" className="size-2 shrink-0 rounded-full bg-primary" />
          )}
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{item.body}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          {label} · {formatRelative(item.createdAt)}
        </span>
      </button>

      {onRemove && (
        <button
          type="button"
          aria-label="Supprimer la notification"
          onClick={() => onRemove(item.id)}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-opacity outline-none sm:opacity-0 sm:group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}
