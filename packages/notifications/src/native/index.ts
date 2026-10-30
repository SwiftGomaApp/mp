import type { PushOpenEvent, PushPermission, PushProvider } from "../core/push";

export interface ExpoConstantsLike {
  executionEnvironment?: string | null;
  appOwnership?: string | null;
}

export function isExpoGo(constants: ExpoConstantsLike): boolean {
  return constants.executionEnvironment === "storeClient" || constants.appOwnership === "expo";
}

export function isPushSupported(constants: ExpoConstantsLike): boolean {
  return !isExpoGo(constants);
}

interface OneSignalClick {
  notification: { additionalData?: unknown };
}

interface OneSignalChange {
  current: { id?: string | null };
}

export interface OneSignalSdk {
  initialize(appId: string): void;
  login(externalId: string): void;
  logout(): void;
  Notifications: {
    getPermissionAsync(): Promise<boolean>;
    canRequestPermission?(): Promise<boolean>;
    requestPermission(fallbackToSettings: boolean): Promise<boolean>;
    addEventListener(event: "click", handler: (event: OneSignalClick) => void): void;
    removeEventListener(event: "click", handler: (event: OneSignalClick) => void): void;
  };
  User: {
    pushSubscription: {
      getIdAsync(): Promise<string | null | undefined>;
      addEventListener(event: "change", handler: (event: OneSignalChange) => void): void;
      removeEventListener(event: "change", handler: (event: OneSignalChange) => void): void;
    };
  };
}

export interface OneSignalProviderOptions {
  appId: string;
  load: () => unknown;
  openSettingsWhenRefused?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findSdk(loaded: unknown): OneSignalSdk {
  const candidates = isRecord(loaded) ? [loaded.OneSignal, loaded.default, loaded] : [loaded];
  for (const candidate of candidates) {
    if (isRecord(candidate) && typeof candidate.initialize === "function") {
      return candidate as unknown as OneSignalSdk;
    }
    if (isRecord(candidate) && isRecord(candidate.OneSignal)) {
      return candidate.OneSignal as unknown as OneSignalSdk;
    }
  }
  throw new Error("swiftgoma-mp-notifications: react-native-onesignal did not load");
}

function readOpen(event: OneSignalClick): PushOpenEvent {
  const data = event.notification.additionalData;
  const read = (key: string): string | null =>
    isRecord(data) && typeof data[key] === "string" ? data[key] : null;
  return { notificationId: read("notificationId"), type: read("type") };
}

export function createOneSignalProvider(options: OneSignalProviderOptions): PushProvider {
  let sdk: OneSignalSdk | null = null;

  function get(): OneSignalSdk {
    if (!sdk) throw new Error("swiftgoma-mp-notifications: call init() first");
    return sdk;
  }

  async function permission(): Promise<PushPermission> {
    const { Notifications } = get();
    if (await Notifications.getPermissionAsync()) return "granted";
    const canAsk = await Notifications.canRequestPermission?.();
    return canAsk === false ? "denied" : "undetermined";
  }

  return {
    async init(): Promise<void> {
      if (sdk) return;
      const loaded = findSdk(options.load());
      loaded.initialize(options.appId);
      sdk = loaded;
    },

    getPermission: permission,

    async requestPermission(): Promise<PushPermission> {
      const granted = await get().Notifications.requestPermission(
        options.openSettingsWhenRefused ?? false,
      );
      return granted ? "granted" : permission();
    },

    async getSubscriptionId(): Promise<string | null> {
      return (await get().User.pushSubscription.getIdAsync()) ?? null;
    },

    onSubscriptionChange(listener): () => void {
      const { pushSubscription } = get().User;
      const handler = (event: OneSignalChange): void => listener(event.current.id ?? null);
      pushSubscription.addEventListener("change", handler);
      return () => pushSubscription.removeEventListener("change", handler);
    },

    onOpen(listener): () => void {
      const { Notifications } = get();
      const handler = (event: OneSignalClick): void => listener(readOpen(event));
      Notifications.addEventListener("click", handler);
      return () => Notifications.removeEventListener("click", handler);
    },

    async identify(userId: string): Promise<void> {
      get().login(userId);
    },

    async forget(): Promise<void> {
      get().logout();
    },
  };
}
