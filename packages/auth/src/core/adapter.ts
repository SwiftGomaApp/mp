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
}
