"use client";

import { BellOff, CheckCheck } from "lucide-react";
import { useInbox, useRealtimeState } from "swiftgoma-mp-notifications/react";

import {
  CONTEXT_META,
  type NotificationContext,
} from "@/components/notifications/notification-meta";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorText } from "@/components/security/recovery-codes-step";

function logFailure(error: unknown) {
  console.warn("[notifications] action failed", error);
}

export function InboxView() {
  const {
    items,
    status,
    nextCursor,
    loadingMore,
    unreadCount,
    byContext,
    context,
    setContext,
    loadMore,
    refresh,
    markRead,
    markAllRead,
    remove,
  } = useInbox();
  const { status: liveStatus } = useRealtimeState();

  const contexts = (Object.keys(CONTEXT_META) as NotificationContext[]).filter(
    (value) => (byContext[value] ?? 0) > 0 || value === context,
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="font-semibold">Notifications</h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Tout est lu"}
              <span
                title={liveStatus === "connected" ? "Mises à jour en direct" : "Hors connexion"}
                className={
                  liveStatus === "connected"
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-muted-foreground/40"
                }
              />
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0}
            onClick={() => markAllRead(context ?? undefined).catch(logFailure)}
          >
            <CheckCheck data-icon="inline-start" />
            Tout marquer comme lu
          </Button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les notifications">
          <Button
            size="sm"
            variant={context === null ? "default" : "outline"}
            aria-pressed={context === null}
            onClick={() => setContext(null)}
          >
            Toutes
          </Button>
          {contexts.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={context === value ? "default" : "outline"}
              aria-pressed={context === value}
              onClick={() => setContext(value)}
            >
              {CONTEXT_META[value].label} ({byContext[value] ?? 0})
            </Button>
          ))}
        </div>
      </section>

      {status === "error" && (
        <div className="flex flex-wrap items-center gap-3">
          <ErrorText>Impossible de charger vos notifications.</ErrorText>
          <Button size="sm" variant="outline" onClick={() => refresh()}>
            Réessayer
          </Button>
        </div>
      )}

      <ul className="grid gap-2">
        {(status === "loading" || status === "idle") && (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        )}

        {status === "ready" && items.length === 0 && (
          <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
            <BellOff className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
          </li>
        )}

        {items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            onRead={(id) => markRead(id).catch(logFailure)}
            onRemove={(id) => remove(id).catch(logFailure)}
          />
        ))}
      </ul>

      {nextCursor && (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={loadingMore}
          onClick={() => loadMore()}
        >
          {loadingMore && <Spinner data-icon="inline-start" />}
          Charger plus
        </Button>
      )}
    </div>
  );
}
