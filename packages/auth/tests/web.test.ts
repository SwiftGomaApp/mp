import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVICE_ID_STORAGE_KEY, createDeviceIdentity } from "../src/index";
import { createWebAdapter, createWebStorage, describeBrowser } from "../src/web/index";
import type { StorageLike } from "../src/web/index";

const AGENTS = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  samsungAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeBrowser", () => {
  it.each([
    [AGENTS.chromeWindows, "Chrome on Windows"],
    [AGENTS.edgeWindows, "Edge on Windows"],
    [AGENTS.firefoxLinux, "Firefox on Linux"],
    [AGENTS.safariMac, "Safari on macOS"],
    [AGENTS.safariIphone, "Safari on iOS"],
    [AGENTS.chromeAndroid, "Chrome on Android"],
    [AGENTS.chromeIos, "Chrome on iOS"],
    [AGENTS.operaWindows, "Opera on Windows"],
    [AGENTS.samsungAndroid, "Samsung Internet on Android"],
  ])("names %#", (agent, expected) => {
    expect(describeBrowser(agent)).toBe(expected);
  });

  it("gives what it can, or nothing", () => {
    expect(describeBrowser("SomeBot/1.0 (Windows NT 10.0)")).toBe("Windows");
    expect(describeBrowser("curl/8.0")).toBeUndefined();
    expect(describeBrowser("")).toBeUndefined();
    expect(describeBrowser(undefined)).toBeUndefined();
  });
});

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("createWebStorage", () => {
  it("reads and writes the browser storage", async () => {
    const source = fakeStorage();
    const storage = createWebStorage(() => source);
    await storage.setItem("k", "v");
    expect(source.data.get("k")).toBe("v");
    expect(await storage.getItem("k")).toBe("v");
    await storage.removeItem("k");
    expect(source.data.has("k")).toBe(false);
    expect(await storage.getItem("k")).toBeNull();
  });

  it("sees a value written by another tab", async () => {
    const source = fakeStorage();
    const storage = createWebStorage(() => source);
    source.data.set("k", "from another tab");
    expect(await storage.getItem("k")).toBe("from another tab");
  });

  it("keeps values in memory when the browser refuses to write", async () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const storage = createWebStorage(() => blocked);
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("works when the storage object cannot even be reached", async () => {
    const storage = createWebStorage(() => {
      throw new Error("SecurityError");
    });
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
  });

  it("works when there is no storage at all", async () => {
    const storage = createWebStorage(() => undefined);
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
  });
});

describe("createWebAdapter", () => {
  it("is a WEB adapter", () => {
    expect(createWebAdapter().platform).toBe("WEB");
  });

  it("names the device from the user agent", async () => {
    const adapter = createWebAdapter({ userAgent: AGENTS.firefoxLinux });
    expect(await adapter.getDeviceName?.()).toBe("Firefox on Linux");
  });

  it("reads the user agent of the current browser by default", async () => {
    vi.stubGlobal("navigator", { userAgent: AGENTS.chromeWindows });
    expect(await createWebAdapter().getDeviceName?.()).toBe("Chrome on Windows");
  });

  it("copes with a missing navigator", async () => {
    vi.stubGlobal("navigator", undefined);
    expect(await createWebAdapter().getDeviceName?.()).toBeUndefined();
  });

  it("gives a device identity that survives a reload", async () => {
    const source = fakeStorage();
    const make = () =>
      createDeviceIdentity(
        createWebAdapter({
          storage: createWebStorage(() => source),
          userAgent: AGENTS.edgeWindows,
        }),
      );

    const first = await make().get();
    expect(first).toMatchObject({ platform: "WEB", deviceName: "Edge on Windows" });
    expect(source.data.get(DEVICE_ID_STORAGE_KEY)).toBe(first.deviceId);
    expect((await make().get()).deviceId).toBe(first.deviceId);
  });

  it("passes the id generator through", async () => {
    const identity = createDeviceIdentity(
      createWebAdapter({
        storage: createWebStorage(() => undefined),
        randomId: () => "my-web-id-1",
      }),
    );
    expect((await identity.get()).deviceId).toBe("my-web-id-1");
  });
});
