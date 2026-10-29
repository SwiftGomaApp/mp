import { describe, expect, it } from "vitest";
import { DEVICE_ID_STORAGE_KEY, createDeviceIdentity } from "../src/index";
import { createNativeAdapter, createNativeStorage, toNativePlatform } from "../src/native/index";
import type { SecureStoreLike } from "../src/native/index";

function fakeSecureStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: (key) => Promise.resolve(data.get(key) ?? null),
    setItemAsync: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

describe("toNativePlatform", () => {
  it("maps React Native's platform names", () => {
    expect(toNativePlatform("ios")).toBe("IOS");
    expect(toNativePlatform("android")).toBe("ANDROID");
  });

  it.each(["web", "windows", "macos", "IOS", ""])("refuses %j", (os) => {
    expect(() => toNativePlatform(os)).toThrow(TypeError);
  });

  it("points web users to the web adapter", () => {
    expect(() => toNativePlatform("web")).toThrow(/swiftgoma-mp-auth\/web/);
  });
});

describe("createNativeStorage", () => {
  it("reads, writes and deletes through secure storage", async () => {
    const secure = fakeSecureStore();
    const storage = createNativeStorage(secure);
    await storage.setItem("k", "v");
    expect(secure.data.get("k")).toBe("v");
    expect(await storage.getItem("k")).toBe("v");
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("lets errors through, so an unsaved token is never taken for a saved one", async () => {
    const storage = createNativeStorage({
      getItemAsync: () => Promise.reject(new Error("keychain locked")),
      setItemAsync: () => Promise.reject(new Error("keychain locked")),
      deleteItemAsync: () => Promise.reject(new Error("keychain locked")),
    });
    await expect(storage.getItem("k")).rejects.toThrow("keychain locked");
    await expect(storage.setItem("k", "v")).rejects.toThrow("keychain locked");
    await expect(storage.removeItem("k")).rejects.toThrow("keychain locked");
  });

  it("uses a storage key that secure storage accepts", () => {
    expect(DEVICE_ID_STORAGE_KEY).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe("createNativeAdapter", () => {
  it("builds an Android or iOS adapter", () => {
    const secureStore = fakeSecureStore();
    expect(createNativeAdapter({ os: "android", secureStore }).platform).toBe("ANDROID");
    expect(createNativeAdapter({ os: "ios", secureStore }).platform).toBe("IOS");
  });

  it("refuses an unsupported platform right away", () => {
    expect(() => createNativeAdapter({ os: "web", secureStore: fakeSecureStore() })).toThrow(
      TypeError,
    );
  });

  it("names the device from the model first", async () => {
    const secureStore = fakeSecureStore();
    const name = (device?: object) =>
      createNativeAdapter({ os: "ios", secureStore, device }).getDeviceName?.();

    expect(await name({ modelName: "iPhone 15", deviceName: "Gael's phone", brand: "Apple" })).toBe(
      "iPhone 15",
    );
    expect(await name({ modelName: null, deviceName: "Gael's phone" })).toBe("Gael's phone");
    expect(await name({ modelName: "", deviceName: null, brand: "Samsung" })).toBe("Samsung");
    expect(await name({})).toBeUndefined();
    expect(await name(undefined)).toBeUndefined();
  });

  it("gives a device identity that survives a restart", async () => {
    const secure = fakeSecureStore();
    const make = () =>
      createDeviceIdentity(
        createNativeAdapter({
          os: "android",
          secureStore: secure,
          device: { modelName: "Pixel 8" },
        }),
      );

    const first = await make().get();
    expect(first).toMatchObject({ platform: "ANDROID", deviceName: "Pixel 8" });
    expect(secure.data.get(DEVICE_ID_STORAGE_KEY)).toBe(first.deviceId);
    expect((await make().get()).deviceId).toBe(first.deviceId);
  });

  it("passes the id generator through", async () => {
    const identity = createDeviceIdentity(
      createNativeAdapter({
        os: "ios",
        secureStore: fakeSecureStore(),
        randomId: () => "my-native-id-1",
      }),
    );
    expect((await identity.get()).deviceId).toBe("my-native-id-1");
  });
});
