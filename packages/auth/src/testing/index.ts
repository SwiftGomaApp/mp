import type { AuthAdapter } from "../core/adapter";
import type { Platform } from "../core/constants";
import { createMemoryStorage } from "../core/memory-storage";

export * from "./fake-server";

/**
 * An adapter for tests: storage in memory and a predictable device. Pass the same `storage` to
 * a second adapter to simulate restarting the app.
 */
export function createTestAdapter(
  platform: Platform = "ANDROID",
  storage: AuthAdapter["storage"] = createMemoryStorage(),
): AuthAdapter {
  return {
    platform,
    storage,
    getDeviceName: () => "Test device",
    randomId: () => "test-device-0001",
  };
}
