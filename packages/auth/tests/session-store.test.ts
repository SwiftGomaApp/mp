import { describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  createMemoryStorage,
  createSessionStore,
} from "../src/index";
import type { AuthAdapter, KeyValueStorage, SessionTokens } from "../src/index";

interface User {
  id: string;
}

const tokens = (n: number): SessionTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresInSeconds: 900,
});

const mobile = (storage: KeyValueStorage = createMemoryStorage()): AuthAdapter => ({
  platform: "ANDROID",
  storage,
});
const browser = (storage: KeyValueStorage = createMemoryStorage()): AuthAdapter => ({
  platform: "WEB",
  storage,
});

describe("a new store", () => {
  it("knows nothing yet", () => {
    const store = createSessionStore<User>(mobile());
    expect(store.getState()).toEqual({ status: "unknown", user: null, accessExpiresAt: null });
    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
  });
});

describe("mobile: signing in", () => {
  it("keeps the user and the tokens, in memory and in storage", async () => {
    const storage = createMemoryStorage();
    const store = createSessionStore<User>(mobile(storage), { now: () => 1_000_000 });
    await store.signIn({ id: "u1" }, tokens(1));

    expect(store.getState()).toEqual({
      status: "authenticated",
      user: { id: "u1" },
      accessExpiresAt: 1_000_000 + 900_000,
    });
    expect(store.getAccessToken()).toBe("access-1");
    expect(store.getRefreshToken()).toBe("refresh-1");
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-1");
    expect(JSON.parse((await storage.getItem(ACCESS_TOKEN_STORAGE_KEY)) ?? "")).toEqual({
      token: "access-1",
      expiresAt: 1_900_000,
    });
  });

  it("assumes the usual 15 minutes when neither the server nor the token says", async () => {
    const store = createSessionStore<User>(mobile(), { now: () => 5_000 });
    await store.signIn({ id: "u1" }, { accessToken: "a", refreshToken: "r" });
    expect(store.getState().accessExpiresAt).toBe(5_000 + 900_000);
  });

  it("refuses a sign-in without both tokens", async () => {
    const store = createSessionStore<User>(mobile());
    await expect(store.signIn({ id: "u1" })).rejects.toThrow(TypeError);
    await expect(
      store.signIn({ id: "u1" }, { accessToken: "a", refreshToken: "" }),
    ).rejects.toThrow(TypeError);
    expect(store.getState().status).toBe("unknown");
  });
});

describe("mobile: rotating the tokens", () => {
  it("replaces the tokens and keeps the user", async () => {
    const storage = createMemoryStorage();
    const store = createSessionStore<User>(mobile(storage), { now: () => 0 });
    await store.signIn({ id: "u1" }, tokens(1));
    await store.updateTokens(tokens(2));

    expect(store.getState().user).toEqual({ id: "u1" });
    expect(store.getAccessToken()).toBe("access-2");
    expect(store.getRefreshToken()).toBe("refresh-2");
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-2");
  });

  it("never lets an older write land after a newer one", async () => {
    const values = new Map<string, string>();
    let slow = true;
    const storage: KeyValueStorage = {
      getItem: (key) => Promise.resolve(values.get(key) ?? null),
      setItem: async (key, value) => {
        if (slow && value === "refresh-1") await new Promise((r) => setTimeout(r, 20));
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
        return Promise.resolve();
      },
    };
    const store = createSessionStore<User>(mobile(storage));
    const first = store.signIn({ id: "u1" }, tokens(1));
    slow = false;
    const second = store.updateTokens(tokens(2));
    await Promise.all([first, second]);
    expect(values.get(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-2");
  });

  it("keeps the session for this run and reports it when storage fails", async () => {
    const failing: KeyValueStorage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.reject(new Error("keychain locked")),
      removeItem: () => Promise.resolve(),
    };
    const store = createSessionStore<User>(mobile(failing));
    await expect(store.signIn({ id: "u1" }, tokens(1))).rejects.toThrow("keychain locked");
    expect(store.getState().status).toBe("authenticated");
    expect(store.getAccessToken()).toBe("access-1");

    // A failed write does not block the next one.
    await expect(store.updateTokens(tokens(2))).rejects.toThrow("keychain locked");
    expect(store.getAccessToken()).toBe("access-2");
  });
});

describe("mobile: starting the app again", () => {
  it("finds the tokens from the last run, still to be checked with the server", async () => {
    const storage = createMemoryStorage();
    await createSessionStore<User>(mobile(storage), { now: () => 0 }).signIn(
      { id: "u1" },
      tokens(1),
    );

    const next = createSessionStore<User>(mobile(storage));
    await next.hydrate();
    expect(next.getRefreshToken()).toBe("refresh-1");
    expect(next.getAccessToken()).toBe("access-1");
    expect(next.getState()).toEqual({ status: "unknown", user: null, accessExpiresAt: 900_000 });
  });

  it("is anonymous when nothing was kept", async () => {
    const store = createSessionStore<User>(mobile());
    await store.hydrate();
    expect(store.getState().status).toBe("anonymous");
  });

  it("can still refresh when only the refresh token survived", async () => {
    const storage = createMemoryStorage({ [REFRESH_TOKEN_STORAGE_KEY]: "refresh-9" });
    const store = createSessionStore<User>(mobile(storage));
    await store.hydrate();
    expect(store.getRefreshToken()).toBe("refresh-9");
    expect(store.getAccessToken()).toBeNull();
  });

  it.each(["not json", "42", "null", '{"token":""}', '{"expiresAt":1}'])(
    "ignores a damaged access entry: %s",
    async (raw) => {
      const storage = createMemoryStorage({
        [REFRESH_TOKEN_STORAGE_KEY]: "refresh-1",
        [ACCESS_TOKEN_STORAGE_KEY]: raw,
      });
      const store = createSessionStore<User>(mobile(storage));
      await store.hydrate();
      expect(store.getAccessToken()).toBeNull();
      expect(store.getRefreshToken()).toBe("refresh-1");
    },
  );

  it("throws a storage error and stays undecided, so the app can retry", async () => {
    const locked: KeyValueStorage = {
      getItem: () => Promise.reject(new Error("keychain locked")),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
    const store = createSessionStore<User>(mobile(locked));
    await expect(store.hydrate()).rejects.toThrow("keychain locked");
    expect(store.getState().status).toBe("unknown");
  });
});

describe("clear", () => {
  it("forgets everything, in memory and in storage", async () => {
    const storage = createMemoryStorage();
    const store = createSessionStore<User>(mobile(storage));
    await store.signIn({ id: "u1" }, tokens(1));
    await store.clear();

    expect(store.getState()).toEqual({ status: "anonymous", user: null, accessExpiresAt: null });
    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(await storage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("ends the session in memory even when storage fails", async () => {
    const failing: KeyValueStorage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.reject(new Error("keychain locked")),
    };
    const store = createSessionStore<User>(mobile(failing));
    await store.signIn({ id: "u1" }, tokens(1));
    await expect(store.clear()).rejects.toThrow("keychain locked");
    expect(store.getState().status).toBe("anonymous");
    expect(store.getAccessToken()).toBeNull();
  });
});

describe("browser", () => {
  it("keeps the user and never touches storage for tokens", async () => {
    const storage = createMemoryStorage();
    const store = createSessionStore<User>(browser(storage), { now: () => 5_000 });
    await store.signIn({ id: "u1" });

    expect(store.getState()).toEqual({
      status: "authenticated",
      user: { id: "u1" },
      accessExpiresAt: 5_000 + 900_000,
    });
    expect(store.getAccessToken()).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(await storage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("refuses tokens, because the cookies hold the session", async () => {
    const store = createSessionStore<User>(browser());
    await expect(store.signIn({ id: "u1" }, tokens(1))).rejects.toThrow(TypeError);
    await expect(store.updateTokens(tokens(1))).rejects.toThrow(TypeError);
  });

  it("starts undecided and signs out cleanly", async () => {
    const store = createSessionStore<User>(browser());
    await store.hydrate();
    expect(store.getState().status).toBe("unknown");
    await store.signIn({ id: "u1" });
    await store.clear();
    expect(store.getState().status).toBe("anonymous");
  });
});

describe("listeners", () => {
  it("tells subscribers about every change until they stop listening", async () => {
    const store = createSessionStore<User>(mobile());
    const seen: string[] = [];
    const stop = store.subscribe((state) => seen.push(state.status));

    await store.signIn({ id: "u1" }, tokens(1));
    store.setUser({ id: "u2" });
    stop();
    await store.clear();

    expect(seen).toEqual(["authenticated", "authenticated"]);
    expect(store.getState().status).toBe("anonymous");
  });

  it("hands out a new state object on each change", async () => {
    const store = createSessionStore<User>(mobile());
    const before = store.getState();
    await store.signIn({ id: "u1" }, tokens(1));
    expect(store.getState()).not.toBe(before);
    expect(before.status).toBe("unknown");
  });

  it("announces access tokens, and null when the session ends", async () => {
    const store = createSessionStore<User>(mobile());
    const seen: (string | null)[] = [];
    store.onAccessTokenChange((token) => seen.push(token));

    await store.signIn({ id: "u1" }, tokens(1));
    await store.updateTokens(tokens(2));
    await store.clear();

    expect(seen).toEqual(["access-1", "access-2", null]);
  });

  it("does not announce a token on clear when there was none", async () => {
    const store = createSessionStore<User>(mobile());
    const listener = vi.fn();
    store.onAccessTokenChange(listener);
    await store.clear();
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps going when one listener throws", async () => {
    const store = createSessionStore<User>(mobile());
    const good = vi.fn();
    store.subscribe(() => {
      throw new Error("bad listener");
    });
    store.subscribe(good);
    store.onAccessTokenChange(() => {
      throw new Error("bad listener");
    });

    await store.signIn({ id: "u1" }, tokens(1));
    expect(good).toHaveBeenCalledTimes(1);
  });
});
