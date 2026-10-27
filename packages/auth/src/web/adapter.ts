import {
  ConfigError,
  PLATFORMS,
  type AppLifecycle,
  type DeviceInfo,
  type Logger,
  type PlatformAdapter,
  type RefreshLock,
  type SessionStore,
} from "../core/index";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export interface DocumentLike extends EventTarget {
  readonly visibilityState: string;
}

export interface WebEnvironment {
  storage?: StorageLike | undefined;
  locks?: LockManagerLike | undefined;
  window?: EventTarget | undefined;
  document?: DocumentLike | undefined;
  randomUUID?: (() => string) | undefined;
}

export interface WebAdapterOptions {
  environment?: WebEnvironment;
  deviceName?: string | null | (() => string | null | undefined);
  keyPrefix?: string;
  logger?: Logger;
}

const DEFAULT_KEY_PREFIX = "swiftgoma.auth";
const DEVICE_ID_MIN_LENGTH = 8;
const DEVICE_ID_MAX_LENGTH = 128;
const DEVICE_NAME_MAX_LENGTH = 100;

interface BrowserGlobals {
  localStorage?: StorageLike;
  navigator?: { locks?: LockManagerLike };
  window?: EventTarget;
  document?: DocumentLike;
  crypto?: {
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
  };
}

function browserUuid(): string {
  const crypto = (globalThis as unknown as BrowserGlobals).crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();

  if (crypto?.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  throw new ConfigError("no secure random source is available to create a device id");
}

function defaultEnvironment(): WebEnvironment {
  const scope = globalThis as unknown as BrowserGlobals;

  let storage: StorageLike | undefined;
  try {
    storage = scope.localStorage;
  } catch {
    storage = undefined;
  }

  return {
    storage,
    locks: scope.navigator?.locks,
    window: scope.window,
    document: scope.document,
    randomUUID: browserUuid,
  };
}

function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function resolveKeyPrefix(value: string | undefined): string {
  const prefix = value ?? DEFAULT_KEY_PREFIX;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prefix)) {
    throw new ConfigError(
      "keyPrefix must start with a letter or digit and only contain letters, digits, '.', '-' and '_'",
    );
  }
  return prefix;
}

function isValidDeviceId(value: string): boolean {
  return (
    value.length >= DEVICE_ID_MIN_LENGTH &&
    value.length <= DEVICE_ID_MAX_LENGTH &&
    value === value.trim()
  );
}

function createLock(locks: LockManagerLike, logger: Logger): RefreshLock {
  return {
    async run<T>(name: string, task: () => Promise<T>): Promise<T> {
      let started = false;
      try {
        return await locks.request(name, async () => {
          started = true;
          return task();
        });
      } catch (error) {
        if (started) throw error;
        logger.warn("Web Locks are unavailable, refreshing without the cross-tab lock", error);
        return task();
      }
    },
  };
}

export function createWebAdapter(options: WebAdapterOptions = {}): PlatformAdapter {
  const env: WebEnvironment = { ...defaultEnvironment(), ...options.environment };
  const logger: Logger = options.logger ?? { debug() {}, warn() {}, error() {} };
  const prefix = resolveKeyPrefix(options.keyPrefix);
  const sessionKey = `${prefix}.session`;
  const deviceKey = `${prefix}.device-id`;
  const randomUUID = env.randomUUID ?? browserUuid;

  let storage: StorageLike | null = null;
  if (env.storage) {
    try {
      const probe = `${prefix}.probe`;
      env.storage.setItem(probe, "1");
      env.storage.removeItem(probe);
      storage = env.storage;
    } catch (error) {
      logger.warn("browser storage is blocked, the session will not survive a reload", error);
    }
  }
  const sharedStorage = storage !== null;
  const area: StorageLike = storage ?? createMemoryStorage();

  const win = env.window;
  const doc = env.document;
  const lock = env.locks ? createLock(env.locks, logger) : undefined;

  const store: SessionStore = {
    async load() {
      const raw = area.getItem(sessionKey);
      if (raw === null) return null;

      let expiresAt: unknown;
      try {
        expiresAt = (JSON.parse(raw) as { accessTokenExpiresAt?: unknown } | null)
          ?.accessTokenExpiresAt;
      } catch {
        expiresAt = undefined;
      }

      if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
        logger.warn("the saved session is unreadable and was removed");
        area.removeItem(sessionKey);
        return null;
      }
      return { accessToken: null, refreshToken: null, accessTokenExpiresAt: expiresAt };
    },

    async save(record) {
      area.setItem(
        sessionKey,
        JSON.stringify({ accessTokenExpiresAt: record.accessTokenExpiresAt }),
      );
    },

    async clear() {
      area.removeItem(sessionKey);
    },

    subscribe(listener) {
      if (!sharedStorage || !win) return () => undefined;

      const handler = (event: Event) => {
        const { key, storageArea } = event as Event & {
          key?: string | null;
          storageArea?: unknown;
        };
        if (storageArea !== area) return;
        if (key === null || key === sessionKey) listener();
      };
      win.addEventListener("storage", handler);
      return () => win.removeEventListener("storage", handler);
    },
  };

  const lifecycle: AppLifecycle = {
    onForeground(listener) {
      if (!doc) return () => undefined;

      let hidden = doc.visibilityState === "hidden";
      const onVisibility = () => {
        const nowHidden = doc.visibilityState === "hidden";
        const returned = hidden && !nowHidden;
        hidden = nowHidden;
        if (returned) listener();
      };
      const onPageShow = (event: Event) => {
        if ((event as Event & { persisted?: boolean }).persisted) listener();
      };

      doc.addEventListener("visibilitychange", onVisibility);
      win?.addEventListener("pageshow", onPageShow);
      return () => {
        doc.removeEventListener("visibilitychange", onVisibility);
        win?.removeEventListener("pageshow", onPageShow);
      };
    },
  };

  async function createDeviceId(): Promise<string> {
    try {
      const stored = area.getItem(deviceKey);
      if (stored !== null && isValidDeviceId(stored)) return stored;
    } catch (error) {
      logger.warn("could not read the device id, using a temporary one", error);
      return randomUUID();
    }

    const created = randomUUID();
    try {
      area.setItem(deviceKey, created);
    } catch (error) {
      logger.warn("could not save the device id, it will change on the next page load", error);
    }
    return created;
  }

  let deviceId: Promise<string> | null = null;
  function resolveDeviceId(): Promise<string> {
    return lock ? lock.run(deviceKey, createDeviceId) : createDeviceId();
  }

  function readDeviceName(): string | undefined {
    const raw =
      typeof options.deviceName === "function" ? options.deviceName() : options.deviceName;
    if (typeof raw !== "string") return undefined;
    const name = raw.slice(0, DEVICE_NAME_MAX_LENGTH).trim();
    return name === "" ? undefined : name;
  }

  return {
    platform: PLATFORMS.WEB,
    transport: "cookie",
    store,
    lifecycle,
    lock,
    async getDeviceInfo(): Promise<DeviceInfo> {
      deviceId ??= resolveDeviceId();
      const name = readDeviceName();
      return {
        deviceId: await deviceId,
        platform: PLATFORMS.WEB,
        ...(name ? { deviceName: name } : {}),
      };
    },
  };
}
