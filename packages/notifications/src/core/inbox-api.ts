import type { AxiosInstance } from "axios";
import {
  expectRecord,
  readNullableString,
  readNumber,
  readString,
  unexpectedAnswer,
  isRecord,
} from "./answers";
import { NOTIFICATIONS_PATH } from "./constants";
import type { Context } from "./constants";
import { assertId, assertLimit, pathId } from "./guards";
import type {
  AcknowledgeResult,
  InboxPage,
  InboxQuery,
  NotificationItem,
  OpenedResult,
  ReadAllResult,
  ReadResult,
  RemoveResult,
  UnreadSummary,
} from "./types";

export interface InboxApi {
  list(query?: InboxQuery): Promise<InboxPage>;
  unreadCount(): Promise<UnreadSummary>;
  markRead(id: string): Promise<ReadResult>;
  acknowledge(id: string): Promise<AcknowledgeResult>;
  markAllRead(options?: { context?: Context }): Promise<ReadAllResult>;
  remove(id: string): Promise<RemoveResult>;
  markOpened(id: string): Promise<OpenedResult>;
}

export function createInboxApi(api: AxiosInstance): InboxApi {
  const itemPath = (id: string, action?: string): string =>
    `${NOTIFICATIONS_PATH}/${pathId(id)}${action ? `/${action}` : ""}`;

  return {
    async list(query: InboxQuery = {}): Promise<InboxPage> {
      assertLimit(query.limit);
      const response = await api.get<unknown>(NOTIFICATIONS_PATH, {
        params: {
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.limit !== undefined ? { limit: query.limit } : {}),
          ...(query.context ? { context: query.context } : {}),
          ...(query.unread !== undefined ? { unread: query.unread } : {}),
        },
      });
      const data = expectRecord(response);
      if (!Array.isArray(data.items)) throw unexpectedAnswer(response);
      return {
        items: data.items as NotificationItem[],
        nextCursor: readNullableString(data, "nextCursor"),
        unreadCount: readNumber(response, data, "unreadCount"),
      };
    },

    async unreadCount(): Promise<UnreadSummary> {
      const response = await api.get<unknown>(`${NOTIFICATIONS_PATH}/unread-count`);
      const data = expectRecord(response);
      return {
        unreadCount: readNumber(response, data, "unreadCount"),
        byContext: isRecord(data.byContext) ? (data.byContext as UnreadSummary["byContext"]) : {},
      };
    },

    async markRead(id: string): Promise<ReadResult> {
      assertId(id, "id");
      const response = await api.patch<unknown>(itemPath(id, "read"));
      const data = expectRecord(response);
      return {
        id: readString(response, data, "id"),
        readAt: readNullableString(data, "readAt"),
        unreadCount: readNumber(response, data, "unreadCount"),
      };
    },

    async acknowledge(id: string): Promise<AcknowledgeResult> {
      assertId(id, "id");
      const response = await api.post<unknown>(itemPath(id, "ack"));
      const data = expectRecord(response);
      return {
        id: readString(response, data, "id"),
        acknowledgedAt: readNullableString(data, "acknowledgedAt"),
        unreadCount: readNumber(response, data, "unreadCount"),
      };
    },

    async markAllRead(options: { context?: Context } = {}): Promise<ReadAllResult> {
      const response = await api.post<unknown>(
        `${NOTIFICATIONS_PATH}/read-all`,
        options.context ? { context: options.context } : {},
      );
      const data = expectRecord(response);
      return {
        updated: readNumber(response, data, "updated"),
        unreadCount: readNumber(response, data, "unreadCount"),
      };
    },

    async remove(id: string): Promise<RemoveResult> {
      assertId(id, "id");
      const response = await api.delete<unknown>(itemPath(id));
      const data = expectRecord(response);
      return {
        id: readString(response, data, "id"),
        unreadCount: readNumber(response, data, "unreadCount"),
      };
    },

    async markOpened(id: string): Promise<OpenedResult> {
      assertId(id, "id");
      const response = await api.post<unknown>(itemPath(id, "opened"));
      const data = expectRecord(response);
      return {
        id: readString(response, data, "id"),
        recorded: data.recorded === true,
      };
    },
  };
}
