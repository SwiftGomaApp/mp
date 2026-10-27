import type { SessionStore } from "./adapters";
import type { SessionRecord } from "./types";

export function createMemoryStore(initial: SessionRecord | null = null): SessionStore {
  let record: SessionRecord | null = initial ? { ...initial } : null;

  return {
    async load() {
      return record ? { ...record } : null;
    },
    async save(next) {
      record = { ...next };
    },
    async clear() {
      record = null;
    },
  };
}
