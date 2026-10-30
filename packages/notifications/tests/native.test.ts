import { describe, expect, it, vi } from "vitest";
import { createOneSignalProvider, isExpoGo, isPushSupported } from "../src/native/index";

function fakeSdk(overrides: { granted?: boolean; canRequest?: boolean } = {}) {
  const clicks = new Set<(event: any) => void>();
  const changes = new Set<(event: any) => void>();
  return {
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    Notifications: {
      getPermissionAsync: async () => overrides.granted ?? true,
      canRequestPermission: async () => overrides.canRequest ?? true,
      requestPermission: vi.fn(async () => true),
      addEventListener: (_: string, handler: (event: any) => void) => void clicks.add(handler),
      removeEventListener: (_: string, handler: (event: any) => void) =>
        void clicks.delete(handler),
    },
    User: {
      pushSubscription: {
        getIdAsync: async () => "sub-12345678",
        addEventListener: (_: string, handler: (event: any) => void) => void changes.add(handler),
        removeEventListener: (_: string, handler: (event: any) => void) =>
          void changes.delete(handler),
      },
    },
    click: (data: unknown) => clicks.forEach((h) => h({ notification: { additionalData: data } })),
    change: (id: string | null) => changes.forEach((h) => h({ current: { id } })),
  };
}

describe("Expo Go detection", () => {
  it("recognises Expo Go", () => {
    expect(isExpoGo({ executionEnvironment: "storeClient" })).toBe(true);
    expect(isExpoGo({ appOwnership: "expo" })).toBe(true);
    expect(isPushSupported({ executionEnvironment: "storeClient" })).toBe(false);
  });

  it("allows development builds and store builds", () => {
    expect(isPushSupported({ executionEnvironment: "bare" })).toBe(true);
    expect(isPushSupported({ executionEnvironment: "standalone" })).toBe(true);
    expect(isPushSupported({})).toBe(true);
  });
});

describe("OneSignal provider", () => {
  it("loads the SDK only when init() runs", async () => {
    const load = vi.fn(() => ({ OneSignal: fakeSdk() }));
    const provider = createOneSignalProvider({ appId: "app", load });
    expect(load).not.toHaveBeenCalled();
    await provider.init();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("throws from init() when the native module is missing", async () => {
    const provider = createOneSignalProvider({
      appId: "app",
      load: () => {
        throw new Error("Cannot find native module 'OneSignal'");
      },
    });
    await expect(provider.init()).rejects.toThrow("OneSignal");
  });

  it("accepts the SDK as a named, default or direct export", async () => {
    for (const shape of [
      (s: object) => ({ OneSignal: s }),
      (s: object) => ({ default: s }),
      (s: object) => s,
    ]) {
      const sdk = fakeSdk();
      await createOneSignalProvider({ appId: "app", load: () => shape(sdk) }).init();
      expect(sdk.initialize).toHaveBeenCalledWith("app");
    }
  });

  it("tells granted, undetermined and denied apart", async () => {
    const read = async (options: { granted: boolean; canRequest: boolean }) => {
      const provider = createOneSignalProvider({ appId: "app", load: () => fakeSdk(options) });
      await provider.init();
      return provider.getPermission();
    };
    expect(await read({ granted: true, canRequest: true })).toBe("granted");
    expect(await read({ granted: false, canRequest: true })).toBe("undetermined");
    expect(await read({ granted: false, canRequest: false })).toBe("denied");
  });

  it("reads the subscription and its changes", async () => {
    const sdk = fakeSdk();
    const provider = createOneSignalProvider({ appId: "app", load: () => sdk });
    await provider.init();
    const seen: Array<string | null> = [];
    const stop = provider.onSubscriptionChange((id) => seen.push(id));

    expect(await provider.getSubscriptionId()).toBe("sub-12345678");
    sdk.change("sub-87654321");
    stop();
    sdk.change("ignored");
    expect(seen).toEqual(["sub-87654321"]);
  });

  it("turns a tap into the notification id and type", async () => {
    const sdk = fakeSdk();
    const provider = createOneSignalProvider({ appId: "app", load: () => sdk });
    await provider.init();
    const taps: unknown[] = [];
    provider.onOpen((event) => taps.push(event));

    sdk.click({ notificationId: "n1", type: "order.placed" });
    sdk.click(undefined);
    expect(taps).toEqual([
      { notificationId: "n1", type: "order.placed" },
      { notificationId: null, type: null },
    ]);
  });

  it("ties the install to the user and cuts the tie", async () => {
    const sdk = fakeSdk();
    const provider = createOneSignalProvider({ appId: "app", load: () => sdk });
    await provider.init();
    await provider.identify("user-1");
    await provider.forget();
    expect(sdk.login).toHaveBeenCalledWith("user-1");
    expect(sdk.logout).toHaveBeenCalled();
  });
});
