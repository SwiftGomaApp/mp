import {
  ConfigError,
  PLATFORMS,
  type AppLifecycle,
  type DeviceInfo,
  type Logger,
  type Platform,
  type PlatformAdapter,
  type SessionRecord,
  type SessionStore,
} from "../core/index";

export interface SecureStoreLikeOptions {
  keychainAccessible?: number;
  keychainService?: string;
}

export interface SecureStoreLike {
  readonly AFTER_FIRST_UNLOCK?: number;
  getItemAsync(key: string, options?: SecureStoreLikeOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStoreLikeOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreLikeOptions): Promise<void>;
}

export interface AppStateLike {
  readonly currentState: string;
  addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
}

export interface NativeAdapterOptions {
  secureStore: SecureStoreLike;
  appState: AppStateLike;
  os: string;
  randomUUID: () => string;
  deviceName?: string | null | (() => string | null | undefined);
  userAgent?: string;
  keyPrefix?: string;
  keychainService?: string;
  logger?: Logger;
}

const DEFAULT_KEY_PREFIX = "swiftgoma.auth";
const DEVICE_ID_MIN_LENGTH = 8;
const DEVICE_ID_MAX_LENGTH = 128;
const DEVICE_NAME_MAX_LENGTH = 100;

function resolvePlatform(os: string): Platform {
  if (os === "ios") return PLATFORMS.IOS;
  if (os === "android") return PLATFORMS.ANDROID;
  throw new ConfigError(`the native adapter supports "ios" and "android", not "${os}"`);
}

function resolveKeyPrefix(value: string | undefined): string {
  const prefix = value ?? DEFAULT_KEY_PREFIX;
  if (!/^[A-Za-z0-9._-]+$/.test(prefix)) {
    throw new ConfigError("keyPrefix may only contain letters, digits, '.', '-' and '_'");
  }
  return prefix;
}

function resolveUserAgent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.trim() === "" || /[^\x20-\x7e]/.test(value)) {
    throw new ConfigError("userAgent must be non-empty printable ASCII");
  }
  return value;
}

function isToken(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseRecord(raw: string): SessionRecord | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const { accessToken, refreshToken, accessTokenExpiresAt } = data as Record<string, unknown>;
  if (
    !isToken(accessToken) ||
    typeof refreshToken !== "string" ||
    typeof accessTokenExpiresAt !== "number" ||
    !Number.isFinite(accessTokenExpiresAt)
  ) {
    return null;
  }
  return { accessToken, refreshToken, accessTokenExpiresAt };
}

function isValidDeviceId(value: string): boolean {
  return (
    value.length >= DEVICE_ID_MIN_LENGTH &&
    value.length <= DEVICE_ID_MAX_LENGTH &&
    value === value.trim()
  );
}

export function createNativeAdapter(options: NativeAdapterOptions): PlatformAdapter {
  const { secureStore, appState, randomUUID } = options;
  const platform = resolvePlatform(options.os);
  const prefix = resolveKeyPrefix(options.keyPrefix);
  const userAgent = resolveUserAgent(options.userAgent);
  const logger: Logger = options.logger ?? { debug() {}, warn() {}, error() {} };

  const sessionKey = `${prefix}.session`;
  const deviceKey = `${prefix}.device-id`;
  const secureOptions: SecureStoreLikeOptions = {
    ...(secureStore.AFTER_FIRST_UNLOCK !== undefined
      ? { keychainAccessible: secureStore.AFTER_FIRST_UNLOCK }
      : {}),
    ...(options.keychainService ? { keychainService: options.keychainService } : {}),
  };

  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  }

  const store: SessionStore = {
    load: () =>
      enqueue(async () => {
        const raw = await secureStore.getItemAsync(sessionKey, secureOptions);
        if (raw === null) return null;

        const record = parseRecord(raw);
        if (!record) {
          logger.warn("the saved session is unreadable and was removed");
          await secureStore.deleteItemAsync(sessionKey, secureOptions);
        }
        return record;
      }),
    save: (record) =>
      enqueue(() => secureStore.setItemAsync(sessionKey, JSON.stringify(record), secureOptions)),
    clear: () => enqueue(() => secureStore.deleteItemAsync(sessionKey, secureOptions)),
  };

  const lifecycle: AppLifecycle = {
    onForeground(listener) {
      let previous = appState.currentState;
      const subscription = appState.addEventListener("change", (next) => {
        const returned = next === "active" && previous !== "active";
        previous = next;
        if (returned) listener();
      });
      return () => subscription.remove();
    },
  };

  async function resolveDeviceId(): Promise<string> {
    try {
      const stored = await secureStore.getItemAsync(deviceKey, secureOptions);
      if (stored !== null && isValidDeviceId(stored)) return stored;
    } catch (error) {
      logger.warn("could not read the device id, using a temporary one", error);
      return randomUUID();
    }

    const created = randomUUID();
    try {
      await secureStore.setItemAsync(deviceKey, created, secureOptions);
    } catch (error) {
      logger.warn("could not save the device id, it will change on the next launch", error);
    }
    return created;
  }

  let deviceId: Promise<string> | null = null;

  function readDeviceName(): string | undefined {
    const raw =
      typeof options.deviceName === "function" ? options.deviceName() : options.deviceName;
    if (typeof raw !== "string") return undefined;
    const name = raw.slice(0, DEVICE_NAME_MAX_LENGTH).trim();
    return name === "" ? undefined : name;
  }

  return {
    platform,
    transport: "bearer",
    store,
    lifecycle,
    userAgent,
    async getDeviceInfo(): Promise<DeviceInfo> {
      deviceId ??= resolveDeviceId();
      const name = readDeviceName();
      return { deviceId: await deviceId, platform, ...(name ? { deviceName: name } : {}) };
    },
  };
}
