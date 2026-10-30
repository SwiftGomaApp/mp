export { PLATFORMS, ROLES, DEVICE_ID_MIN_LENGTH, DEVICE_ID_MAX_LENGTH } from "swiftgoma-mp-auth";
export type { Platform, Role } from "swiftgoma-mp-auth";

export const NOTIFICATIONS_PATH = "/notifications";

export const CONTEXTS = [
  "SECURITY",
  "PURCHASE",
  "SALE",
  "DELIVERY",
  "SUPPORT",
  "ADMIN",
  "ANNOUNCEMENT",
  "MARKETING",
] as const;
export type Context = (typeof CONTEXTS)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CHANNELS = ["IN_APP", "PUSH", "SMS", "EMAIL"] as const;
export type Channel = (typeof CHANNELS)[number];

export const PREFERENCE_CHANNELS = ["PUSH", "SMS", "EMAIL"] as const;
export type PreferenceChannel = (typeof PREFERENCE_CHANNELS)[number];

export const INBOX_PAGE_SIZE_DEFAULT = 20;
export const INBOX_PAGE_SIZE_MAX = 50;
export const PREFERENCES_BATCH_MAX = 30;
export const SUBSCRIPTION_ID_MIN_LENGTH = 8;
export const SUBSCRIPTION_ID_MAX_LENGTH = 128;
export const QUIET_MINUTE_MAX = 1439;
export const DEFAULT_TIMEZONE = "Africa/Lubumbashi";

export const SOCKET_PATH = "/socket.io";
export const MAX_SOCKETS_PER_USER = 5;

export const SOCKET_EVENTS = {
  notificationNew: "notification:new",
  notificationRead: "notification:read",
  notificationDeleted: "notification:deleted",
  authExpiring: "auth:expiring",
  authExpired: "auth:expired",
  authRefresh: "auth:refresh",
} as const;

export const SOCKET_ERROR_CODES = [
  "UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "SESSION_REVOKED",
  "ACCOUNT_BLOCKED",
  "TWO_FACTOR_REQUIRED",
  "ORIGIN_NOT_ALLOWED",
  "UNAVAILABLE",
] as const;
export type SocketErrorCode = (typeof SOCKET_ERROR_CODES)[number];

export const SOCKET_FATAL_ERROR_CODES: readonly SocketErrorCode[] = [
  "SESSION_REVOKED",
  "ACCOUNT_BLOCKED",
  "TWO_FACTOR_REQUIRED",
  "ORIGIN_NOT_ALLOWED",
];
