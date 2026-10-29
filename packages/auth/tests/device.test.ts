import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEVICE_ID_STORAGE_KEY,
  DEVICE_NAME_MAX_LENGTH,
  FALLBACK_DEVICE_NAME,
  cleanDeviceName,
  createDeviceIdentity,
  createMemoryStorage,
  generateId,
  isValidDeviceId,
} from "../src/index";
import type { AuthAdapter, KeyValueStorage } from "../src/index";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const adapterWith = (overrides: Partial<AuthAdapter> = {}): AuthAdapter => ({
  platform: "ANDROID",
  storage: createMemoryStorage(),
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("memory storage", () => {
  it("stores, reads and removes values", async () => {
    const storage = createMemoryStorage({ a: "1" });
    expect(await storage.getItem("a")).toBe("1");
    expect(await storage.getItem("missing")).toBeNull();
    await storage.setItem("b", "2");
    expect(await storage.getItem("b")).toBe("2");
    await storage.removeItem("a");
    expect(await storage.getItem("a")).toBeNull();
  });
});

describe("generateId", () => {
  it("makes distinct version 4 UUIDs", () => {
    const ids = new Set(Array.from({ length: 50 }, generateId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it("still works without randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
    expect(generateId()).toMatch(UUID);
  });

  it("still works without any crypto", () => {
    vi.stubGlobal("crypto", undefined);
    expect(generateId()).toMatch(UUID);
  });
});

describe("isValidDeviceId", () => {
  it("follows the server rule: 8 to 128 characters", () => {
    expect(isValidDeviceId("a".repeat(8))).toBe(true);
    expect(isValidDeviceId("a".repeat(128))).toBe(true);
    expect(isValidDeviceId("a".repeat(7))).toBe(false);
    expect(isValidDeviceId("a".repeat(129))).toBe(false);
    expect(isValidDeviceId(" abcdefgh")).toBe(false);
    expect(isValidDeviceId(12345678)).toBe(false);
    expect(isValidDeviceId(null)).toBe(false);
  });
});

describe("cleanDeviceName", () => {
  it("tidies spaces and limits the length", () => {
    expect(cleanDeviceName("  Pixel   8 \n")).toBe("Pixel 8");
    expect(cleanDeviceName("x".repeat(500))).toHaveLength(DEVICE_NAME_MAX_LENGTH);
  });

  it("falls back when there is nothing usable", () => {
    expect(cleanDeviceName(undefined)).toBe(FALLBACK_DEVICE_NAME);
    expect(cleanDeviceName(null)).toBe(FALLBACK_DEVICE_NAME);
    expect(cleanDeviceName("   ")).toBe(FALLBACK_DEVICE_NAME);
  });
});

describe("createDeviceIdentity", () => {
  it("creates the id once and keeps it in storage", async () => {
    const storage = createMemoryStorage();
    const first = await createDeviceIdentity(adapterWith({ storage })).get();
    expect(first.deviceId).toMatch(UUID);
    expect(await storage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first.deviceId);

    const again = await createDeviceIdentity(adapterWith({ storage })).get();
    expect(again.deviceId).toBe(first.deviceId);
  });

  it("returns the platform and the cleaned name", async () => {
    const identity = createDeviceIdentity(
      adapterWith({ platform: "IOS", getDeviceName: () => "  iPhone   15 " }),
    );
    expect(await identity.get()).toMatchObject({ platform: "IOS", deviceName: "iPhone 15" });
  });

  it("accepts a name given asynchronously", async () => {
    const identity = createDeviceIdentity(
      adapterWith({ getDeviceName: () => Promise.resolve("Chrome on Windows") }),
    );
    expect((await identity.get()).deviceName).toBe("Chrome on Windows");
  });

  it("uses the fallback name when the adapter has none or fails", async () => {
    expect((await createDeviceIdentity(adapterWith()).get()).deviceName).toBe(FALLBACK_DEVICE_NAME);
    const broken = adapterWith({
      getDeviceName: () => {
        throw new Error("no device info");
      },
    });
    expect((await createDeviceIdentity(broken).get()).deviceName).toBe(FALLBACK_DEVICE_NAME);
  });

  it("uses the adapter's own id generator", async () => {
    const identity = createDeviceIdentity(adapterWith({ randomId: () => "custom-device-id" }));
    expect((await identity.get()).deviceId).toBe("custom-device-id");
  });

  it("replaces a stored id the server would refuse", async () => {
    const storage = createMemoryStorage({ [DEVICE_ID_STORAGE_KEY]: "short" });
    const { deviceId } = await createDeviceIdentity(adapterWith({ storage })).get();
    expect(deviceId).toMatch(UUID);
    expect(await storage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(deviceId);
  });

  it("gives every concurrent caller the same id", async () => {
    const randomId = vi.fn(() => "only-one-id-1");
    const identity = createDeviceIdentity(adapterWith({ randomId }));
    const results = await Promise.all([identity.get(), identity.get(), identity.get()]);
    expect(new Set(results.map((r) => r.deviceId)).size).toBe(1);
    expect(randomId).toHaveBeenCalledTimes(1);
  });

  it("keeps working for this session when storage is broken", async () => {
    const broken: KeyValueStorage = {
      getItem: () => Promise.reject(new Error("blocked")),
      setItem: () => Promise.reject(new Error("blocked")),
      removeItem: () => Promise.reject(new Error("blocked")),
    };
    const identity = createDeviceIdentity(adapterWith({ storage: broken }));
    const first = await identity.get();
    expect(first.deviceId).toMatch(UUID);
    expect((await identity.get()).deviceId).toBe(first.deviceId);
  });
});
