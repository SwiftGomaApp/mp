import type { Platform } from "./constants";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface AuthAdapter {
  platform: Platform;
  storage: KeyValueStorage;
  getDeviceName?: () => string | undefined | Promise<string | undefined>;
  randomId?: () => string;
  onForeground?: (listener: () => void) => () => void;
  /**
   * Browsers only. Runs the function while holding a lock shared by every tab of the app, so
   * that one tab refreshes at a time: the refresh cookie rotates and cannot be used twice.
   */
  withRefreshLock?: <T>(run: () => Promise<T>) => Promise<T>;
  /** Browsers only. Tells the other tabs that this tab just refreshed the session. */
  announceRefresh?: (expiresInSeconds: number) => void;
  /** Browsers only. Calls the listener when another tab refreshed. Returns a stop function. */
  onRefreshedElsewhere?: (listener: (expiresInSeconds: number) => void) => () => void;
}
