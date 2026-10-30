import { isRecord } from "../core/answers";
import { CONTEXTS } from "../core/constants";
import type { Context } from "../core/constants";
import type {
  NotificationDeletedEvent,
  NotificationNewEvent,
  NotificationReadEvent,
} from "../core/types";

function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((id) => typeof id === "string") ? (value as string[]) : null;
}

function readContext(value: unknown): Context | null {
  return CONTEXTS.find((context) => context === value) ?? null;
}

export function parseNew(payload: unknown): NotificationNewEvent | null {
  if (!isRecord(payload) || !isRecord(payload.notification)) return null;
  if (typeof payload.notification.id !== "string") return null;
  if (typeof payload.unreadCount !== "number") return null;
  return payload as unknown as NotificationNewEvent;
}

export function parseRead(payload: unknown): NotificationReadEvent | null {
  if (!isRecord(payload) || typeof payload.unreadCount !== "number") return null;
  const ids = readIds(payload.ids);
  if (payload.all === true) {
    return { all: true, context: readContext(payload.context), unreadCount: payload.unreadCount };
  }
  return ids ? { ids, unreadCount: payload.unreadCount } : null;
}

export function parseDeleted(payload: unknown): NotificationDeletedEvent | null {
  if (!isRecord(payload) || typeof payload.unreadCount !== "number") return null;
  const ids = readIds(payload.ids);
  return ids ? { ids, unreadCount: payload.unreadCount } : null;
}
