import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  createAuth,
  type Auth,
  type Logger,
  type SessionRecord,
} from "../src/core/index";
import {
  createWebAdapter,
  type DocumentLike,
  type LockManagerLike,
  type StorageLike,
  type WebAdapterOptions,
} from "../src/web/index";

const SESSION_KEY = "swiftgoma.auth.session";
const DEVICE_KEY = "swiftgoma.auth.device-id";
const record: SessionRecord = {
  accessToken: "must-not-be-stored",
  refreshToken: "must-not-be-stored-either",
  accessTokenExpiresAt: 1_800_000_000_000,
};

let current: Auth | null = null;

afterEach(() => {
  current?.destroy();
  current = null;
});

function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike & { data: Map<string, string> } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return storage;
}

function makeDocument(initial = "visible") {
  return Object.assign(new EventTarget(), { visibilityState: initial }) as EventTarget & {
    visibilityState: string;
  };
}

function makeLocks() {
  const queues = new Map<string, Promise<unknown>>();
  const request = vi.fn(async (name: string, callback: () => Promise<unknown>) => {
    const previous = queues.get(name) ?? Promise.resolve();
    const run = previous.then(callback);
    queues.set(
      name,
      run.catch(() => undefined),
    );
    return run;
  });
  return { request, locks: { request } as unknown as LockManagerLike };
}

function makeEnv(initial: Record<string, string> = {}) {
  let counter = 0;
  return {
    storage: makeStorage(initial),
    window: new EventTarget(),
    document: makeDocument(),
    locks: undefined as LockManagerLike | undefined,
    randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`),
  };
}

function makeLogger() {
  const warn = vi.fn();
  const logger: Logger = { debug() {}, warn, error() {} };
  return { logger, warn };
}

function storageEvent(area: unknown, key: string | null) {
  return Object.assign(new Event("storage"), { key, storageArea: area });
}

function adapterWith(env: object, options: WebAdapterOptions = {}) {
  return createWebAdapter({ ...options, environment: env });
}

describe("configuration", () => {
  it("uses cookies on the web platform and sends no User-Agent", () => {
    const adapter = adapterWith(makeEnv());
    expect(adapter).toMatchObject({ platform: "WEB", transport: "cookie" });
    expect(adapter.userAgent).toBeUndefined();
  });

  it("refuses a bad key prefix", () => {
    expect(() => adapterWith(makeEnv(), { keyPrefix: "bad prefix" })).toThrow(ConfigError);
    expect(() => adapterWith(makeEnv(), { keyPrefix: "-lock" })).toThrow(ConfigError);
  });

  it("works with createAuth", async () => {
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterWith(makeEnv()),
    });
    current = auth;

    expect(await auth.session.start()).toEqual({ status: "unauthenticated" });
  });
});

describe("session store", () => {
  it("keeps only the expiry, never a token", async () => {
    const env = makeEnv();
    const { store } = adapterWith(env);

    await store.save(record);
    expect(env.storage.data.get(SESSION_KEY)).toBe(
      JSON.stringify({ accessTokenExpiresAt: record.accessTokenExpiresAt }),
    );
    expect(await store.load()).toEqual({
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: record.accessTokenExpiresAt,
    });

    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("removes an unreadable saved session", async () => {
    for (const raw of ["not json", "null", "{}", '{"accessTokenExpiresAt":"soon"}']) {
      const { logger, warn } = makeLogger();
      const env = makeEnv({ [SESSION_KEY]: raw });

      expect(await adapterWith(env, { logger }).store.load()).toBeNull();
      expect(env.storage.data.has(SESSION_KEY)).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    }
  });

  it("falls back to memory without storage, quietly", async () => {
    const { logger, warn } = makeLogger();
    const { store } = adapterWith({ storage: undefined }, { logger });

    await store.save(record);
    expect((await store.load())?.accessTokenExpiresAt).toBe(record.accessTokenExpiresAt);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to memory, with a warning, when the storage is blocked", async () => {
    const { logger, warn } = makeLogger();
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    const { store } = adapterWith({ storage: blocked }, { logger });

    await store.save(record);
    expect((await store.load())?.accessTokenExpiresAt).toBe(record.accessTokenExpiresAt);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("other tabs", () => {
  it("notifies on this session key and on a full clear, nothing else", () => {
    const env = makeEnv();
    const listener = vi.fn();
    adapterWith(env).store.subscribe?.(listener);

    env.window.dispatchEvent(storageEvent(env.storage, "something.else"));
    env.window.dispatchEvent(storageEvent({}, SESSION_KEY));
    expect(listener).not.toHaveBeenCalled();

    env.window.dispatchEvent(storageEvent(env.storage, SESSION_KEY));
    env.window.dispatchEvent(storageEvent(env.storage, null));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops after unsubscribe, and is a no-op without a window", () => {
    const env = makeEnv();
    const listener = vi.fn();
    const unsubscribe = adapterWith(env).store.subscribe?.(listener);

    unsubscribe?.();
    env.window.dispatchEvent(storageEvent(env.storage, SESSION_KEY));
    expect(listener).not.toHaveBeenCalled();

    const quiet = adapterWith({ storage: makeStorage(), window: undefined });
    expect(() => quiet.store.subscribe?.(listener)?.()).not.toThrow();
  });

  it("signs this tab in when another tab logs in, and out when it logs out", async () => {
    const env = makeEnv();
    const auth = createAuth({ baseUrl: "https://api.example.com", adapter: adapterWith(env) });
    current = auth;
    await auth.session.start();
    expect(auth.session.state).toEqual({ status: "unauthenticated" });

    env.storage.setItem(
      SESSION_KEY,
      JSON.stringify({ accessTokenExpiresAt: Date.now() + 600_000 }),
    );
    env.window.dispatchEvent(storageEvent(env.storage, SESSION_KEY));
    await vi.waitFor(() => expect(auth.session.state).toEqual({ status: "authenticated" }));

    env.storage.removeItem(SESSION_KEY);
    env.window.dispatchEvent(storageEvent(env.storage, SESSION_KEY));
    await vi.waitFor(() =>
      expect(auth.session.state).toEqual({ status: "unauthenticated", reason: "logout" }),
    );
  });
});

describe("refresh lock", () => {
  it("is absent when the browser has no Web Locks", () => {
    expect(adapterWith(makeEnv()).lock).toBeUndefined();
  });

  it("runs the task under the named lock and returns its result", async () => {
    const { request, locks } = makeLocks();
    const adapter = adapterWith({ ...makeEnv(), locks });

    expect(await adapter.lock?.run("refresh", async () => 42)).toBe(42);
    expect(request).toHaveBeenCalledWith("refresh", expect.any(Function));
  });

  it("runs two tasks one after the other", async () => {
    const { locks } = makeLocks();
    const adapter = adapterWith({ ...makeEnv(), locks });
    const events: string[] = [];

    const task = (label: string) => async () => {
      events.push(`${label} start`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push(`${label} end`);
    };

    await Promise.all([
      adapter.lock!.run("refresh", task("a")),
      adapter.lock!.run("refresh", task("b")),
    ]);
    expect(events).toEqual(["a start", "a end", "b start", "b end"]);
  });

  it("passes the task's own error through, and runs it only once", async () => {
    const { locks } = makeLocks();
    const adapter = adapterWith({ ...makeEnv(), locks });
    const task = vi.fn(async () => {
      throw new Error("refresh failed");
    });

    await expect(adapter.lock!.run("refresh", task)).rejects.toThrow("refresh failed");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs the task without the lock when the lock request itself fails", async () => {
    const { logger, warn } = makeLogger();
    const locks = {
      request: vi.fn(async () => {
        throw new DOMException("no lock manager", "SecurityError");
      }),
    } as unknown as LockManagerLike;
    const adapter = adapterWith({ ...makeEnv(), locks }, { logger });

    expect(await adapter.lock!.run("refresh", async () => "done")).toBe("done");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("device info", () => {
  it("creates one id, saves it and returns it every time", async () => {
    const env = makeEnv();
    const adapter = adapterWith(env);

    const first = await adapter.getDeviceInfo();
    const second = await adapter.getDeviceInfo();

    expect(first).toEqual({ deviceId: "00000000-0000-4000-8000-000000000001", platform: "WEB" });
    expect(second.deviceId).toBe(first.deviceId);
    expect(env.randomUUID).toHaveBeenCalledTimes(1);
    expect(env.storage.data.get(DEVICE_KEY)).toBe(first.deviceId);
  });

  it("reuses the saved id in another tab or after a reload", async () => {
    const env = makeEnv();
    const { deviceId } = await adapterWith(env).getDeviceInfo();

    const otherTab = adapterWith({ ...env, randomUUID: () => "never-used-0000" });
    expect((await otherTab.getDeviceInfo()).deviceId).toBe(deviceId);
  });

  it("creates a single id for concurrent calls and for tabs sharing a lock", async () => {
    const env = makeEnv();
    const { locks } = makeLocks();
    const tabA = adapterWith({ ...env, locks });
    const tabB = adapterWith({ ...env, locks });

    const infos = await Promise.all([
      tabA.getDeviceInfo(),
      tabA.getDeviceInfo(),
      tabB.getDeviceInfo(),
    ]);

    expect(env.randomUUID).toHaveBeenCalledTimes(1);
    expect(new Set(infos.map((info) => info.deviceId)).size).toBe(1);
  });

  it("replaces a saved id the server would reject", async () => {
    const env = makeEnv({ [DEVICE_KEY]: "short" });

    const info = await adapterWith(env).getDeviceInfo();
    expect(info.deviceId).toHaveLength(36);
    expect(env.storage.data.get(DEVICE_KEY)).toBe(info.deviceId);
  });

  it("uses a temporary id, without overwriting, when the read fails", async () => {
    const { logger, warn } = makeLogger();
    const env = makeEnv();
    const setItem = vi.spyOn(env.storage, "setItem");
    vi.spyOn(env.storage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const adapter = adapterWith({ ...env, storage: env.storage }, { logger });

    expect((await adapter.getDeviceInfo()).deviceId).toHaveLength(36);
    expect(setItem).not.toHaveBeenCalledWith(DEVICE_KEY, expect.anything());
    expect(warn).toHaveBeenCalled();
  });

  it("trims and cuts the device name, and leaves it out when empty", async () => {
    expect(
      (await adapterWith(makeEnv(), { deviceName: "  Chrome on Windows " }).getDeviceInfo())
        .deviceName,
    ).toBe("Chrome on Windows");
    expect(
      (await adapterWith(makeEnv(), { deviceName: "x".repeat(150) }).getDeviceInfo()).deviceName,
    ).toHaveLength(100);

    for (const deviceName of [undefined, null, "", "  ", () => null]) {
      const info = await adapterWith(makeEnv(), { deviceName }).getDeviceInfo();
      expect(info).not.toHaveProperty("deviceName");
    }
  });
});

describe("foreground hook", () => {
  function setupForeground() {
    const env = makeEnv();
    const listener = vi.fn();
    const unsubscribe = adapterWith(env).lifecycle.onForeground(listener);
    const setVisibility = (state: string) => {
      env.document.visibilityState = state;
      env.document.dispatchEvent(new Event("visibilitychange"));
    };
    return { env, listener, unsubscribe, setVisibility };
  }

  it("fires when the tab becomes visible again", () => {
    const { listener, setVisibility } = setupForeground();

    setVisibility("hidden");
    expect(listener).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores visible to visible", () => {
    const { listener, setVisibility } = setupForeground();

    setVisibility("visible");
    expect(listener).not.toHaveBeenCalled();
  });

  it("fires for a page restored from the back/forward cache only", () => {
    const { env, listener } = setupForeground();

    env.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(listener).not.toHaveBeenCalled();

    env.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops after unsubscribe, and does nothing without a document", () => {
    const { listener, unsubscribe, setVisibility } = setupForeground();

    unsubscribe();
    setVisibility("hidden");
    setVisibility("visible");
    expect(listener).not.toHaveBeenCalled();

    const quiet = adapterWith({
      storage: makeStorage(),
      document: undefined as DocumentLike | undefined,
    });
    expect(() => quiet.lifecycle.onForeground(listener)()).not.toThrow();
  });
});
