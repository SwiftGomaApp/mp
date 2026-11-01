"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, BellOff, Settings } from "lucide-react";
import { useInbox, useUnreadCount } from "swiftgoma-mp-notifications/react";

import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function logFailure(error: unknown) {
  console.warn("[notifications] action failed", error);
}

function BellPanel() {
  const {
    items,
    status,
    nextCursor,
    loadingMore,
    unreadCount,
    loadMore,
    markRead,
    markAllRead,
    remove,
  } = useInbox();
  const sentinel = useRef<HTMLDivElement>(null);

  // Next page when the end of the list scrolls into view.
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !nextCursor) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) void loadMore();
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loadMore]);

  return (
    <>
      <SheetHeader className="gap-1 border-b pr-14">
        <SheetTitle>Notifications</SheetTitle>
        <SheetDescription>
          {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}
        </SheetDescription>
        <Button
          variant="outline"
          size="xs"
          className="mt-2 w-fit"
          disabled={unreadCount === 0}
          onClick={() => markAllRead().catch(logFailure)}
        >
          Tout marquer comme lu
        </Button>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === "loading" || status === "idle" ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : status === "error" ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Impossible de charger vos notifications.
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <BellOff className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  compact
                  onRead={(id) => markRead(id).catch(logFailure)}
                  onRemove={(id) => remove(id).catch(logFailure)}
                />
              ))}
            </ul>
            {nextCursor && (
              <div ref={sentinel} className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => loadMore()}
                >
                  {loadingMore && <Spinner data-icon="inline-start" />}
                  Charger plus
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t p-3">
        <SheetClose
          nativeButton={false}
          render={<Link href="/notifications/settings" />}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Settings className="size-4" />
          Paramètres des notifications
        </SheetClose>
      </div>
    </>
  );
}

export function NotificationBell() {
  const unread = useUnreadCount();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0
                ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`
                : "Notifications"
            }
            className="relative"
          />
        }
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,100vw)] gap-0 p-0 sm:max-w-md">
        <BellPanel />
      </SheetContent>
    </Sheet>
  );
}
