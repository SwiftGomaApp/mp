"use client";

import Link from "next/link";
import { Check, Settings, Trash2 } from "lucide-react";
import { useInbox } from "swiftgoma-mp-notifications/react";

import { Badge, Button, Card, Empty, ErrorBanner, PageHeader, Spinner, cn, formatDate } from "@/components/ui";

const fail = (error: unknown) => console.warn("[notifications] action failed", error);

export default function NotificationsPage() {
  const inbox = useInbox();

  return (
    <>
      <PageHeader
        title="Notifications"
        description={inbox.unreadCount > 0 ? `${inbox.unreadCount} non lue(s)` : "Tout est lu"}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={inbox.unreadCount === 0}
              onClick={() => inbox.markAllRead().catch(fail)}
            >
              <Check className="size-4" /> Tout marquer comme lu
            </Button>
            <Link
              href="/notifications/settings"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted"
            >
              <Settings className="size-4" /> Préférences
            </Link>
          </div>
        }
      />
      <Card>
        {inbox.status === "error" && <ErrorBanner error={new Error("Impossible de charger les notifications.")} />}
        {(inbox.status === "idle" || inbox.status === "loading") && <Spinner />}
        {inbox.status === "ready" && inbox.items.length === 0 && <Empty>Aucune notification.</Empty>}
        <ul className="divide-y divide-border">
          {inbox.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <span
                className={cn("mt-2 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-primary")}
                aria-label={item.readAt ? "Lue" : "Non lue"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge>{item.context}</Badge>
                  {formatDate(item.createdAt)}
                </p>
              </div>
              {!item.readAt && (
                <Button size="sm" variant="ghost" onClick={() => inbox.markRead(item.id).catch(fail)}>
                  Marquer lue
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Supprimer"
                onClick={() => inbox.remove(item.id).catch(fail)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        {inbox.nextCursor && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" loading={inbox.loadingMore} onClick={() => inbox.loadMore()}>
              Charger plus
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
