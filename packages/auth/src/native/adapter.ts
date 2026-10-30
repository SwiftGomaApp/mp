import type { AuthAdapter } from "../core/adapter";
import type { Platform } from "../core/constants";
import { watchAppForeground } from "./foreground";
import type { AppStateLike } from "./foreground";
import { createNativeStorage } from "./storage";
import type { SecureStoreLike } from "./storage";

export interface DeviceInfoLike {
  modelName?: string | null;
  deviceName?: string | null;
  brand?: string | null;
}

export interface NativeAdapterOptions {
  os: string;
  secureStore: SecureStoreLike;
  device?: DeviceInfoLike;
  appState?: AppStateLike;
  randomId?: () => string;
}

export function toNativePlatform(os: string): Platform {
  if (os === "ios") return "IOS";
  if (os === "android") return "ANDROID";
  throw new TypeError(
    `swiftgoma-mp-auth/native supports "ios" and "android", got "${os}". ` +
      `For the web, use createWebAdapter from "swiftgoma-mp-auth/web".`,
  );
}

function describeDevice(device: DeviceInfoLike | undefined): string | undefined {
  return device?.modelName || device?.deviceName || device?.brand || undefined;
}

export function createNativeAdapter(options: NativeAdapterOptions): AuthAdapter {
  const { appState } = options;
  const adapter: AuthAdapter = {
    platform: toNativePlatform(options.os),
    storage: createNativeStorage(options.secureStore),
    getDeviceName: () => describeDevice(options.device),
  };
  if (appState) adapter.onForeground = (listener) => watchAppForeground(appState, listener);
  if (options.randomId) adapter.randomId = options.randomId;
  return adapter;
}
