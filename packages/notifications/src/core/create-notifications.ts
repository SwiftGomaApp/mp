import { createDevicesApi } from "./devices-api";
import type { DevicesApi } from "./devices-api";
import { createInboxApi } from "./inbox-api";
import type { InboxApi } from "./inbox-api";
import { createInboxStore } from "./inbox-store";
import type { InboxStore } from "./inbox-store";
import { createCatalogApi, createPreferencesApi } from "./preferences-api";
import type { CatalogApi, PreferencesApi } from "./preferences-api";
import { createPushController } from "./push";
import type { NotificationsAuth, PushController, PushProvider } from "./push";

export interface CreateNotificationsOptions {
  auth: NotificationsAuth;
  push?: PushProvider;
  pushEnabled?: boolean;
  pageSize?: number;
  onError?: (error: unknown) => void;
}

export interface Notifications {
  inbox: InboxApi;
  store: InboxStore;
  preferences: PreferencesApi;
  catalog: CatalogApi;
  devices: DevicesApi;
  push: PushController;
  start(): void;
  stop(): void;
}

export function createNotifications(options: CreateNotificationsOptions): Notifications {
  if (!options?.auth?.api) {
    throw new TypeError("swiftgoma-mp-notifications: auth is required");
  }
  const { auth } = options;
  const inbox = createInboxApi(auth.api);
  const devices = createDevicesApi(auth.api);
  const store = createInboxStore({
    inbox,
    pageSize: options.pageSize,
    onError: options.onError,
  });
  const push = createPushController({
    auth,
    devices,
    inbox,
    provider: options.push,
    enabled: options.pushEnabled,
    onError: options.onError,
  });

  let stopSession: (() => void) | null = null;

  return {
    inbox,
    store,
    preferences: createPreferencesApi(auth.api),
    catalog: createCatalogApi(auth.api),
    devices,
    push,

    start(): void {
      push.start();
      if (stopSession) return;
      let lastUser = auth.session.getState().user?.id ?? null;
      stopSession = auth.session.subscribe((session) => {
        const user = session.user?.id ?? null;
        if (lastUser && user !== lastUser) store.reset();
        lastUser = user;
      });
    },

    stop(): void {
      push.stop();
      stopSession?.();
      stopSession = null;
    },
  };
}
