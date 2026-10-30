import type { Platform } from "swiftgoma-mp-auth";
import type { Channel, Context, Priority, PreferenceChannel } from "./constants";
import type { Escalation, EventType } from "./events";

export interface NotificationItem {
  id: string;
  type: EventType | (string & {});
  context: Context;
  priority: Priority;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface InboxQuery {
  cursor?: string;
  limit?: number;
  context?: Context;
  unread?: boolean;
}

export interface InboxPage {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface UnreadSummary {
  unreadCount: number;
  byContext: Partial<Record<Context, number>>;
}

export interface ReadResult {
  id: string;
  readAt: string | null;
  unreadCount: number;
}

export interface AcknowledgeResult {
  id: string;
  acknowledgedAt: string | null;
  unreadCount: number;
}

export interface ReadAllResult {
  updated: number;
  unreadCount: number;
}

export interface RemoveResult {
  id: string;
  unreadCount: number;
}

export interface OpenedResult {
  id: string;
  recorded: boolean;
}

export interface PreferenceChannelState {
  channel: Channel;
  locked: boolean;
  enabled: boolean;
}

export interface PreferenceCategory {
  context: Context;
  label: string;
  locked: boolean;
  hasMandatory: boolean;
  channels: PreferenceChannelState[];
}

export interface NotificationSettings {
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  marketingEmailOptIn: boolean;
}

export type SettingsPatch = Partial<NotificationSettings>;

export interface Preferences {
  categories: PreferenceCategory[];
  settings: NotificationSettings;
}

export interface PreferenceChange {
  context: Context;
  channel: PreferenceChannel;
  enabled: boolean;
}

export interface CatalogEntry {
  type: EventType | (string & {});
  context: Context;
  priority: Priority;
  mandatory: boolean;
  channels: Channel[];
  escalation: Escalation | null;
}

export interface DeviceRegistrationInput {
  subscriptionId: string;
  deviceId: string;
  platform: Platform;
}

export interface NotificationNewEvent {
  notification: NotificationItem;
  unreadCount: number;
}

export interface NotificationReadEvent {
  ids?: string[];
  all?: boolean;
  context?: Context | null;
  unreadCount: number;
}

export interface NotificationDeletedEvent {
  ids: string[];
  unreadCount: number;
}
