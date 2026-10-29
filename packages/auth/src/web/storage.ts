import type { KeyValueStorage } from "../core/adapter";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createWebStorage(
  source: () => StorageLike | undefined = browserStorage,
): KeyValueStorage {
  const memory = new Map<string, string>();

  return {
    getItem(key: string): Promise<string | null> {
      try {
        const stored = source()?.getItem(key);
        if (stored !== null && stored !== undefined) return Promise.resolve(stored);
      } catch {}
      return Promise.resolve(memory.get(key) ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
      memory.set(key, value);
      try {
        source()?.setItem(key, value);
      } catch {}
      return Promise.resolve();
    },

    removeItem(key: string): Promise<void> {
      memory.delete(key);
      try {
        source()?.removeItem(key);
      } catch {}
      return Promise.resolve();
    },
  };
}
