import type { AuthAdapter, KeyValueStorage } from "../core/adapter";
import { describeBrowser } from "./device-name";
import { watchBrowserForeground } from "./foreground";
import { createWebStorage } from "./storage";
import { createTabCoordination } from "./tabs";
import type { TabEnvironment } from "./tabs";

export interface WebAdapterOptions {
  storage?: KeyValueStorage;
  userAgent?: string;
  randomId?: () => string;
  tabs?: TabEnvironment;
}

export function createWebAdapter(options: WebAdapterOptions = {}): AuthAdapter {
  const adapter: AuthAdapter = {
    platform: "WEB",
    storage: options.storage ?? createWebStorage(),
    getDeviceName: () => describeBrowser(options.userAgent ?? globalThis.navigator?.userAgent),
    onForeground: (listener) => watchBrowserForeground(listener),
    ...createTabCoordination(options.tabs),
  };
  if (options.randomId) adapter.randomId = options.randomId;
  return adapter;
}
