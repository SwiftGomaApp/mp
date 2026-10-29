import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApiError,
  createMemoryStorage,
  createNetworkError,
  createSessionStore,
  createTokenScheduler,
} from "../src/index";
import type { Platform, SessionStore } from "../src/index";

const MIN = 60_000;
const START = 1_000_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

// A refresh that behaves like the real one: it rotates the tokens in the store.
function fakeRefresh(store: SessionStore, ttlSeconds = 900) {
  let count = 0;
  const refreshNow = vi.fn(async () => {
    count += 1;
    await store.updateTokens({
      accessToken: `access-${count + 1}`,
      refreshToken: `refresh-${count + 1}`,
      expiresInSeconds: ttlSeconds,
    });
  });
  return { refreshNow };
}

async function setup(platform: Platform = "ANDROID", ttlSeconds = 900) {
  const store = createSessionStore({ platform, storage: createMemoryStorage() });
  if (platform === "WEB") await store.signIn({ id: "u1" });
  else {
    await store.signIn(
      { id: "u1" },
      { accessToken: "access-1", refreshToken: "refresh-1", expiresInSeconds: ttlSeconds },
    );
  }
  const refresh = fakeRefresh(store, ttlSeconds);
  return { store, refresh };
}

const make = (
  store: SessionStore,
  refresh: { refreshNow: () => Promise<void> },
  extra: object = {},
) => createTokenScheduler({ store, refresh, random: () => 0, ...extra });

describe("scheduled refresh", () => {
  it("refreshes 5 minutes before the token expires", async () => {
    const { store, refresh } = await setup();
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(10 * MIN - 1);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("starts a little earlier by a random amount", async () => {
    const { store, refresh } = await setup();
    make(store, refresh, { random: () => 1 }).start();

    await vi.advanceTimersByTimeAsync(10 * MIN - 30_000);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("keeps going: the next refresh is planned after each one", async () => {
    const { store, refresh } = await setup();
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(3);
  });

  it("refreshes at once when the token is already inside the margin", async () => {
    const { store, refresh } = await setup();
    vi.setSystemTime(START + 12 * MIN);
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nobody is signed in", async () => {
    const store = createSessionStore({ platform: "ANDROID", storage: createMemoryStorage() });
    const refresh = fakeRefresh(store);
    make(store, refresh).start();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("assumes the usual 15 minutes for a browser sign-in that does not say", async () => {
    const { store, refresh } = await setup("WEB");
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(10 * MIN - 1);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("follows a browser expiry once the server tells it", async () => {
    const { store, refresh } = await setup("WEB");
    make(store, refresh).start();
    store.setAccessExpiresIn(900);

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("stops when the session ends", async () => {
    const { store, refresh } = await setup();
    make(store, refresh).start();
    await store.clear();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("stops when told to", async () => {
    const { store, refresh } = await setup();
    const scheduler = make(store, refresh);
    scheduler.start();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("does not start twice", async () => {
    const { store, refresh } = await setup();
    const scheduler = make(store, refresh);
    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("waits again when the delay is longer than a timer can hold", async () => {
    const store = createSessionStore({ platform: "ANDROID", storage: createMemoryStorage() });
    await store.signIn(
      { id: "u1" },
      { accessToken: "a", refreshToken: "r", expiresInSeconds: 40 * 24 * 3600 },
    );
    const refresh = fakeRefresh(store);
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(30 * 24 * 3600 * 1000);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10 * 24 * 3600 * 1000);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });
});

describe("when a scheduled refresh fails", () => {
  it("tries again after 5, 15, 30 then every 60 seconds, and keeps the session", async () => {
    const { store } = await setup();
    const refreshNow = vi.fn(() => Promise.reject(createNetworkError()));
    make(store, { refreshNow }).start();

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refreshNow).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshNow).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(refreshNow).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refreshNow).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshNow).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refreshNow).toHaveBeenCalledTimes(6);

    expect(store.getState().status).toBe("authenticated");
  });

  it("goes back to the normal rhythm after a success", async () => {
    const { store } = await setup();
    let failing = true;
    const refreshNow = vi.fn(async () => {
      if (failing) throw createNetworkError();
      await store.updateTokens({ accessToken: "n", refreshToken: "n", expiresInSeconds: 900 });
    });
    make(store, { refreshNow }).start();

    await vi.advanceTimersByTimeAsync(10 * MIN);
    failing = false;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refreshNow).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refreshNow).toHaveBeenCalledTimes(3);
  });

  it("does not retry early because something else changed in the session", async () => {
    const { store } = await setup();
    const refreshNow = vi.fn(() => Promise.reject(createNetworkError()));
    make(store, { refreshNow }).start();

    await vi.advanceTimersByTimeAsync(10 * MIN);
    store.setUser({ id: "u1" });
    store.setUser({ id: "u1" });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the session has ended", async () => {
    const { store } = await setup();
    const refreshNow = vi.fn(async () => {
      await store.clear();
      throw createApiError({
        status: 401,
        body: { error: { code: "TOKEN_REUSED", message: "x" } },
      });
    });
    make(store, { refreshNow }).start();

    await vi.advanceTimersByTimeAsync(10 * MIN);
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it("does not spin when a new token is already inside the margin", async () => {
    const { store } = await setup("ANDROID", 200);
    const refresh = fakeRefresh(store, 200);
    make(store, refresh).start();

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(2);
  });
});

describe("coming back to the foreground", () => {
  function withForeground() {
    let notify: () => void = () => undefined;
    const stop = vi.fn();
    const onForeground = vi.fn((listener: () => void) => {
      notify = listener;
      return stop;
    });
    return { onForeground, stop, fire: () => notify() };
  }

  it("refreshes if the token ran into the margin while the app slept", async () => {
    const { store, refresh } = await setup();
    const foreground = withForeground();
    make(store, refresh, { onForeground: foreground.onForeground }).start();

    vi.setSystemTime(START + 13 * MIN);
    foreground.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("does nothing if the token is still fresh", async () => {
    const { store, refresh } = await setup();
    const foreground = withForeground();
    make(store, refresh, { onForeground: foreground.onForeground }).start();

    foreground.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("does not raise an error when that refresh fails", async () => {
    const { store } = await setup();
    const foreground = withForeground();
    const refreshNow = vi.fn(() => Promise.reject(createNetworkError()));
    make(store, { refreshNow }, { onForeground: foreground.onForeground }).start();

    vi.setSystemTime(START + 13 * MIN);
    foreground.fire();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the scheduler stops", async () => {
    const { store, refresh } = await setup();
    const foreground = withForeground();
    const scheduler = make(store, refresh, { onForeground: foreground.onForeground });
    scheduler.start();
    scheduler.stop();
    expect(foreground.stop).toHaveBeenCalledTimes(1);
  });
});

describe("getAccessToken", () => {
  it("returns the current token when it is fresh", async () => {
    const { store, refresh } = await setup();
    const scheduler = make(store, refresh);
    expect(await scheduler.getAccessToken()).toBe("access-1");
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("refreshes first when the token is about to expire", async () => {
    const { store, refresh } = await setup();
    const scheduler = make(store, refresh);
    vi.setSystemTime(START + 14.8 * MIN);
    expect(await scheduler.getAccessToken()).toBe("access-2");
    expect(refresh.refreshNow).toHaveBeenCalledTimes(1);
  });

  it("gives every simultaneous request the new token", async () => {
    const { store } = await setup();
    let calls = 0;
    const refreshNow = vi.fn(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 100));
      await store.updateTokens({ accessToken: "fresh", refreshToken: "r2", expiresInSeconds: 900 });
    });
    const scheduler = make(store, { refreshNow });
    vi.setSystemTime(START + 14.8 * MIN);

    const results = Promise.all([scheduler.getAccessToken(), scheduler.getAccessToken()]);
    await vi.advanceTimersByTimeAsync(100);
    expect(await results).toEqual(["fresh", "fresh"]);
    expect(calls).toBe(2); // each asks; the real refresh manager merges them into one request
  });

  it("returns a token that still works when the refresh fails", async () => {
    const { store } = await setup();
    const refreshNow = vi.fn(() => Promise.reject(createNetworkError()));
    const scheduler = make(store, { refreshNow });
    vi.setSystemTime(START + 14.8 * MIN);

    expect(await scheduler.getAccessToken()).toBe("access-1");
    // Right after a failure it does not hammer the server again.
    expect(await scheduler.getAccessToken()).toBe("access-1");
    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it("throws when the token has expired and the refresh fails", async () => {
    const { store } = await setup();
    const refreshNow = vi.fn(() => Promise.reject(createNetworkError()));
    const scheduler = make(store, { refreshNow });
    vi.setSystemTime(START + 16 * MIN);

    await expect(scheduler.getAccessToken()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("refreshes when only the refresh token survived a restart", async () => {
    const storage = createMemoryStorage({ "swiftgoma-mp-auth.refreshToken": "refresh-1" });
    const store = createSessionStore({ platform: "ANDROID", storage });
    await store.hydrate();
    const refresh = fakeRefresh(store);

    expect(await make(store, refresh).getAccessToken()).toBe("access-2");
  });

  it("returns null when nobody is signed in", async () => {
    const store = createSessionStore({ platform: "ANDROID", storage: createMemoryStorage() });
    const refresh = fakeRefresh(store);
    expect(await make(store, refresh).getAccessToken()).toBeNull();
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });

  it("returns null in a browser, where cookies carry the session", async () => {
    const { store, refresh } = await setup("WEB");
    store.setAccessExpiresIn(10);
    expect(await make(store, refresh).getAccessToken()).toBeNull();
    expect(refresh.refreshNow).not.toHaveBeenCalled();
  });
});
