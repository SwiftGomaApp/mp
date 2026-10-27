import type { Platform } from "./constants";
import type { DeviceInfo, SessionRecord } from "./types";

export type TokenTransport = "bearer" | "cookie";

export interface SessionStore {
  load(): Promise<SessionRecord | null>;
  save(record: SessionRecord): Promise<void>;
  clear(): Promise<void>;
  subscribe?(listener: () => void): () => void;
}

export interface AppLifecycle {
  onForeground(listener: () => void): () => void;
}

export interface RefreshLock {
  run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  readonly transport: TokenTransport;
  readonly store: SessionStore;
  readonly lifecycle: AppLifecycle;
  readonly lock?: RefreshLock | undefined;
  readonly userAgent?: string | undefined;
  getDeviceInfo(): Promise<DeviceInfo>;
}
