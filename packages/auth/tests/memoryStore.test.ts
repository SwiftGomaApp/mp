import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../src/core/memoryStore";
import type { SessionRecord } from "../src/core/types";

const record: SessionRecord = {
  accessToken: "access",
  refreshToken: "refresh",
  accessTokenExpiresAt: 1_700_000_000_000,
};

describe("memory store", () => {
  it("starts empty", async () => {
    expect(await createMemoryStore().load()).toBeNull();
  });

  it("can start with a session", async () => {
    expect(await createMemoryStore(record).load()).toEqual(record);
  });

  it("saves, loads and clears", async () => {
    const store = createMemoryStore();
    await store.save(record);
    expect(await store.load()).toEqual(record);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("works in cookie mode, where the tokens are null", async () => {
    const store = createMemoryStore();
    const cookieRecord: SessionRecord = {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: 5,
    };
    await store.save(cookieRecord);
    expect(await store.load()).toEqual(cookieRecord);
  });

  it("does not share objects with its callers", async () => {
    const store = createMemoryStore();
    const input = { ...record };
    await store.save(input);
    input.accessToken = "changed";
    const loaded = await store.load();
    expect(loaded?.accessToken).toBe("access");
    if (loaded) loaded.refreshToken = "changed";
    expect((await store.load())?.refreshToken).toBe("refresh");
  });
});
