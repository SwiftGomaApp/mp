import type { KeyValueStorage } from "../core/adapter";

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createNativeStorage(secureStore: SecureStoreLike): KeyValueStorage {
  return {
    getItem: (key: string): Promise<string | null> => secureStore.getItemAsync(key),
    setItem: (key: string, value: string): Promise<void> => secureStore.setItemAsync(key, value),
    removeItem: (key: string): Promise<void> => secureStore.deleteItemAsync(key),
  };
}
