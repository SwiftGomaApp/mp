import type { AuthAdapter } from "./adapter";
import { DEVICE_ID_MAX_LENGTH, DEVICE_ID_MIN_LENGTH, DEVICE_NAME_MAX_LENGTH } from "./constants";
import type { Platform } from "./constants";

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: Platform;
}

export interface DeviceIdentity {
  get(): Promise<DeviceInfo>;
}

export const DEVICE_ID_STORAGE_KEY = "swiftgoma-mp-auth.deviceId";
export const FALLBACK_DEVICE_NAME = "Appareil inconnu";

export function generateId(): string {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === "function") return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === "function") {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function isValidDeviceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= DEVICE_ID_MIN_LENGTH &&
    value.length <= DEVICE_ID_MAX_LENGTH &&
    value === value.trim()
  );
}

export function cleanDeviceName(name: string | undefined | null): string {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim().slice(0, DEVICE_NAME_MAX_LENGTH).trim();
  return trimmed || FALLBACK_DEVICE_NAME;
}

async function readStoredId(adapter: AuthAdapter): Promise<string | null> {
  try {
    const stored = await adapter.storage.getItem(DEVICE_ID_STORAGE_KEY);
    return isValidDeviceId(stored) ? stored : null;
  } catch {
    return null;
  }
}

async function readName(adapter: AuthAdapter): Promise<string> {
  try {
    return cleanDeviceName(await adapter.getDeviceName?.());
  } catch {
    return FALLBACK_DEVICE_NAME;
  }
}

export function createDeviceIdentity(adapter: AuthAdapter): DeviceIdentity {
  let pending: Promise<DeviceInfo> | undefined;

  async function load(): Promise<DeviceInfo> {
    let deviceId = await readStoredId(adapter);
    if (!deviceId) {
      deviceId = adapter.randomId?.() ?? generateId();
      try {
        await adapter.storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      } catch {
        // Kept in memory only.
      }
    }
    return { deviceId, deviceName: await readName(adapter), platform: adapter.platform };
  }

  return {
    get(): Promise<DeviceInfo> {
      pending ??= load();
      return pending;
    },
  };
}
