import { describe, expect, it, vi } from "vitest";
import { ConfigError, createAuth, type Logger, type SessionRecord } from "../src/core/index";
import { createNativeAdapter, type NativeAdapterOptions } from "../src/native/index";

const SESSION_KEY = "swiftgoma.auth.session";
const DEVICE_KEY = "swiftgoma.auth.device-id";
const record: SessionRecord = {
  accessToken: "access",
  refreshToken: "refresh",
  accessTokenExpiresAt: 1_800_000_000_000,
};

function makeSecureStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    AFTER_FIRST_UNLOCK: 7,
    data,
    getItemAsync: vi.fn(async (key: string, _options?: unknown) => data.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string, _options?: unknown) => {
      data.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string, _options?: unknown) => {
      data.delete(key);
    }),
  };
}

function makeAppState(initial: string | null = "active") {
  const listeners = new Set<(state: string) => void>();
  const removed = vi.fn();
  return {
    currentState: initial,
    removed,
    addEventListener: vi.fn((_type: "change", listener: (state: string) => void) => {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
          removed();
        },
      };
    }),
    emit(state: string) {
      for (const listener of [...listeners]) listener(state);
    },
  };
}

function makeLogger() {
  const warn = vi.fn();
  const logger: Logger = { debug() {}, warn, error() {} };
  return { logger, warn };
}

function setup(
  overrides: Partial<NativeAdapterOptions> = {},
  initial: Record<string, string> = {},
) {
  const secureStore = makeSecureStore(initial);
  const appState = makeAppState();
  let counter = 0;
  const randomUUID = vi.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`);
  const adapter = createNativeAdapter({
    secureStore,
    appState,
    os: "android",
    randomUUID,
    ...overrides,
  });
  return { adapter, secureStore, appState, randomUUID };
}

describe("configuration", () => {
  it("maps the OS to the platform and always uses bearer tokens", () => {
    expect(setup({ os: "android" }).adapter).toMatchObject({
      platform: "ANDROID",
      transport: "bearer",
    });
    expect(setup({ os: "ios" }).adapter.platform).toBe("IOS");
  });

  it("refuses other systems, bad key prefixes and bad user agents", () => {
    expect(() => setup({ os: "web" })).toThrow(ConfigError);
    expect(() => setup({ keyPrefix: "bad prefix!" })).toThrow(ConfigError);
    expect(() => setup({ userAgent: "" })).toThrow(ConfigError);
    expect(() => setup({ userAgent: "App/1.0\r\nX-Evil: 1" })).toThrow(ConfigError);
    expect(() => setup({ userAgent: "Appé/1.0" })).toThrow(ConfigError);
  });

  it("passes the user agent through", () => {
    expect(setup({ userAgent: "SwiftGoma-Buyer/1.2.0 (ios)" }).adapter.userAgent).toBe(
      "SwiftGoma-Buyer/1.2.0 (ios)",
    );
    expect(setup().adapter.userAgent).toBeUndefined();
  });

  it("works with createAuth", async () => {
    const { adapter } = setup();
    const auth = createAuth({ baseUrl: "https://api.example.com", adapter });

    expect(await auth.session.start()).toEqual({ status: "unauthenticated" });
    auth.destroy();
  });
});

describe("session store", () => {
  it("saves, loads and clears, with the unlock-friendly keychain option", async () => {
    const { adapter, secureStore } = setup();

    expect(await adapter.store.load()).toBeNull();
    await adapter.store.save(record);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(SESSION_KEY, JSON.stringify(record), {
      keychainAccessible: 7,
    });
    expect(await adapter.store.load()).toEqual(record);

    await adapter.store.clear();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_KEY, {
      keychainAccessible: 7,
    });
    expect(await adapter.store.load()).toBeNull();
  });

  it("uses the custom prefix and keychain service", async () => {
    const { adapter, secureStore } = setup({ keyPrefix: "buyer", keychainService: "buyer-app" });

    await adapter.store.save(record);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith("buyer.session", expect.any(String), {
      keychainAccessible: 7,
      keychainService: "buyer-app",
    });
  });

  it("removes an unreadable saved session and reports no session", async () => {
    const broken = [
      "not json",
      "null",
      JSON.stringify({ accessToken: "a" }),
      JSON.stringify({ ...record, refreshToken: null }),
      JSON.stringify({ ...record, accessTokenExpiresAt: "soon" }),
    ];

    for (const raw of broken) {
      const { logger, warn } = makeLogger();
      const { adapter, secureStore } = setup({ logger }, { [SESSION_KEY]: raw });

      expect(await adapter.store.load()).toBeNull();
      expect(secureStore.data.has(SESSION_KEY)).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    }
  });

  it("lets a read error through instead of looking like a logout", async () => {
    const { adapter, secureStore } = setup();
    secureStore.getItemAsync.mockRejectedValueOnce(new Error("keychain unavailable"));

    await expect(adapter.store.load()).rejects.toThrow("keychain unavailable");
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("keeps writes in order, so a slow save cannot undo a clear", async () => {
    const { adapter, secureStore } = setup();
    secureStore.setItemAsync.mockImplementationOnce(async (key: string, value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      secureStore.data.set(key, value);
    });

    const saving = adapter.store.save(record);
    const clearing = adapter.store.clear();
    await Promise.all([saving, clearing]);

    expect(await adapter.store.load()).toBeNull();
  });
});

describe("device info", () => {
  it("creates one id, saves it and keeps returning it", async () => {
    const { adapter, secureStore, randomUUID } = setup();

    const first = await adapter.getDeviceInfo();
    const second = await adapter.getDeviceInfo();

    expect(first.deviceId).toBe("00000000-0000-4000-8000-000000000001");
    expect(second.deviceId).toBe(first.deviceId);
    expect(first.platform).toBe("ANDROID");
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(secureStore.data.get(DEVICE_KEY)).toBe(first.deviceId);
  });

  it("creates a single id for concurrent calls", async () => {
    const { adapter, randomUUID } = setup();

    const [a, b, c] = await Promise.all([
      adapter.getDeviceInfo(),
      adapter.getDeviceInfo(),
      adapter.getDeviceInfo(),
    ]);

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(new Set([a.deviceId, b.deviceId, c.deviceId]).size).toBe(1);
  });

  it("reuses the saved id after a restart", async () => {
    const first = setup();
    const { deviceId } = await first.adapter.getDeviceInfo();

    const restarted = createNativeAdapter({
      secureStore: first.secureStore,
      appState: first.appState,
      os: "android",
      randomUUID: () => "should-not-be-used-0000",
    });
    expect((await restarted.getDeviceInfo()).deviceId).toBe(deviceId);
  });

  it("replaces a saved id the server would reject", async () => {
    const { adapter, secureStore } = setup({}, { [DEVICE_KEY]: "short" });

    const info = await adapter.getDeviceInfo();
    expect(info.deviceId).toHaveLength(36);
    expect(secureStore.data.get(DEVICE_KEY)).toBe(info.deviceId);
  });

  it("uses a temporary id, without overwriting, when the read fails", async () => {
    const { logger, warn } = makeLogger();
    const { adapter, secureStore } = setup({ logger });
    secureStore.getItemAsync.mockRejectedValueOnce(new Error("locked"));

    const info = await adapter.getDeviceInfo();
    expect(info.deviceId).toHaveLength(36);
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("still returns an id when saving fails", async () => {
    const { logger, warn } = makeLogger();
    const { adapter, secureStore } = setup({ logger });
    secureStore.setItemAsync.mockRejectedValueOnce(new Error("full"));

    expect((await adapter.getDeviceInfo()).deviceId).toHaveLength(36);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("trims and cuts the device name, and leaves it out when empty", async () => {
    expect((await setup({ deviceName: "  Pixel 8  " }).adapter.getDeviceInfo()).deviceName).toBe(
      "Pixel 8",
    );
    expect(
      (await setup({ deviceName: "x".repeat(150) }).adapter.getDeviceInfo()).deviceName,
    ).toHaveLength(100);
    expect(
      (await setup({ deviceName: () => "iPhone 15" }).adapter.getDeviceInfo()).deviceName,
    ).toBe("iPhone 15");

    for (const deviceName of [null, "", "   ", () => null]) {
      const info = await setup({ deviceName }).adapter.getDeviceInfo();
      expect(info).not.toHaveProperty("deviceName");
    }
  });
});

describe("foreground hook", () => {
  it("works when React Native does not know the current state yet", () => {
    const appState = makeAppState(null);
    const adapter = createNativeAdapter({
      secureStore: makeSecureStore(),
      appState,
      os: "android",
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    });
    const listener = vi.fn();
    adapter.lifecycle.onForeground(listener);

    appState.emit("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fires when the app comes back from the background", () => {
    const { adapter, appState } = setup();
    const listener = vi.fn();
    adapter.lifecycle.onForeground(listener);

    appState.emit("background");
    expect(listener).not.toHaveBeenCalled();

    appState.emit("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores active to active and the brief inactive state", () => {
    const { adapter, appState } = setup();
    const listener = vi.fn();
    adapter.lifecycle.onForeground(listener);

    appState.emit("active");
    appState.emit("inactive");
    expect(listener).not.toHaveBeenCalled();

    appState.emit("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unsubscribed", () => {
    const { adapter, appState } = setup();
    const listener = vi.fn();
    const unsubscribe = adapter.lifecycle.onForeground(listener);

    unsubscribe();
    appState.emit("background");
    appState.emit("active");

    expect(appState.removed).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
