import type { KeyValueStorage } from "./adapter";

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string): Promise<string | null> => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string): Promise<void> => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string): Promise<void> => {
      values.delete(key);
      return Promise.resolve();
    },
  };
}
