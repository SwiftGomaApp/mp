import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformAdapter, RefreshLock } from "../src/core/adapters";
import { resolveConfig } from "../src/core/config";
import { REFRESH_LOCK_NAME } from "../src/core/constants";
import { ConflictError, NetworkError, UnauthorizedError } from "../src/core/errors";
import { createHttpClient, type UnauthorizedContext } from "../src/core/http";
import { createMemoryStore } from "../src/core/memoryStore";
import { SessionManager, type RefreshCall } from "../src/core/session";
import type { SessionRecord } from "../src/core/types";

function setup(options: { record?: SessionRecord | null; lock?: RefreshLock } = {}) {
  const lifecycle = { listener: null as (() => void) | null };
  const store = createMemoryStore(options.record ?? null);
  const adapter: PlatformAdapter = {
    platform: "ANDROID",
    transport: "bearer",
    store,
    lifecycle: {
      onForeground(listener) {
        lifecycle.listener = listener;
        return () => {
          lifecycle.listener = null;
        };
      },
    },
    lock: options.lock,
    async getDeviceInfo() {
      return { deviceId: "device-12345", platform: "ANDROID" };
    },
  };
  const config = resolveConfig({
    baseUrl: "https://api.example.com",
    adapter,
    now: () => Date.now(),
  });
  const refreshCall = vi.fn<RefreshCall>(async () => ({
    accessToken: "access-2",
    refreshToken: "refresh-2",
    expiresIn: 900,
  }));
  const manager = new SessionManager({ config, refreshCall, random: () => 0 });
  return { manager, store, refreshCall, config, lifecycle };
}

async function login(manager: SessionManager, expiresIn = 900) {
  await manager.startSession({
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresIn,
  });
}

function unauthorizedContext(code: string | undefined) {
  const retry = vi.fn(async () => ({ data: "replayed" }) as AxiosResponse);
  const error = {
    response: { status: 401, data: code ? { error: { code } } : {} },
  } as unknown as AxiosError;
  const context = { error, request: {}, retry } as UnauthorizedContext;
  return { context, retry };
}

function jwt(exp: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ exp })}.sig`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("starting a session", () => {
  it("saves the record and becomes authenticated", async () => {
    const { manager, store } = setup();
    await login(manager);

    expect(manager.state).toEqual({ status: "authenticated" });
    expect(await store.load()).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: Date.now() + 900_000,
    });
  });

  it("falls back to the token exp claim, then to 15 minutes", async () => {
    const first = setup();
    const exp = Math.floor(Date.now() / 1000) + 600;
    await first.manager.startSession({ accessToken: jwt(exp), refreshToken: "r" });
    expect((await first.store.load())?.accessTokenExpiresAt).toBe(exp * 1000);

    const second = setup();
    await second.manager.startSession({ accessToken: "opaque", refreshToken: "r" });
    expect((await second.store.load())?.accessTokenExpiresAt).toBe(Date.now() + 900_000);
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const { manager } = setup();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    await login(manager);
    expect(listener).toHaveBeenLastCalledWith({ status: "authenticated" });

    await manager.endSession();
    expect(listener).toHaveBeenLastCalledWith({ status: "unauthenticated", reason: "logout" });

    unsubscribe();
    await login(manager);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("start", () => {
  it("is unauthenticated when nothing is saved", async () => {
    const { manager } = setup();
    expect(await manager.start()).toEqual({ status: "unauthenticated" });
  });

  it("restores a saved session", async () => {
    const { manager } = setup({
      record: {
        accessToken: "a",
        refreshToken: "r",
        accessTokenExpiresAt: Date.now() + 600_000,
      },
    });
    expect(await manager.start()).toEqual({ status: "authenticated" });
    expect(await manager.getAccessToken()).toBe("a");
  });

  it("renews right away when the saved token is about to expire", async () => {
    const { manager, refreshCall } = setup({
      record: {
        accessToken: "old",
        refreshToken: "refresh-old",
        accessTokenExpiresAt: Date.now() + 60_000,
      },
    });
    await manager.start();

    expect(refreshCall).toHaveBeenCalledWith("refresh-old");
    expect(await manager.getAccessToken()).toBe("access-2");
  });

  it("renews when the app returns to the foreground", async () => {
    const { manager, refreshCall, lifecycle } = setup();
    await manager.start();
    await login(manager, 200);
    expect(refreshCall).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 100_000);
    lifecycle.listener?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshCall).toHaveBeenCalledTimes(1);
  });
});

describe("early refresh", () => {
  it("renews 120 seconds before the token expires", async () => {
    const { manager, refreshCall, store } = setup();
    await login(manager);

    await vi.advanceTimersByTimeAsync(779_999);
    expect(refreshCall).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCall).toHaveBeenCalledWith("refresh-1");
    expect((await store.load())?.accessToken).toBe("access-2");
    expect((await store.load())?.refreshToken).toBe("refresh-2");
  });

  it("shares one call between concurrent refreshes", async () => {
    const { manager, refreshCall } = setup();
    await login(manager);

    await Promise.all([manager.refresh(), manager.refresh(), manager.refresh()]);
    expect(refreshCall).toHaveBeenCalledTimes(1);
  });

  it("keeps the old refresh token when the server sends none", async () => {
    const { manager, refreshCall, store } = setup();
    refreshCall.mockResolvedValueOnce({ expiresIn: 900 });
    await login(manager);

    await manager.refresh();
    expect(await store.load()).toEqual({
      accessToken: null,
      refreshToken: "refresh-1",
      accessTokenExpiresAt: Date.now() + 900_000,
    });
  });

  it("renews before handing out a token that is about to expire", async () => {
    const { manager, refreshCall } = setup();
    await login(manager, 100);

    expect(await manager.getAccessToken()).toBe("access-2");
    expect(refreshCall).toHaveBeenCalledTimes(1);
  });

  it("goes through the lock when the adapter provides one", async () => {
    const run = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    const { manager } = setup({ lock: { run } as unknown as RefreshLock });
    await login(manager);

    await manager.refresh();
    expect(run).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function));
  });

  it("adopts a session another tab already renewed, without calling the server", async () => {
    const { manager, refreshCall, store } = setup();
    await login(manager);

    await store.save({
      accessToken: "access-other",
      refreshToken: "refresh-other",
      accessTokenExpiresAt: Date.now() + 1_800_000,
    });
    await manager.refresh();

    expect(refreshCall).not.toHaveBeenCalled();
    expect(await manager.getAccessToken()).toBe("access-other");
  });

  it("refuses to renew when there is no session", async () => {
    const { manager, refreshCall } = setup();
    await expect(manager.refresh()).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(refreshCall).not.toHaveBeenCalled();
  });
});

describe("refresh failures", () => {
  it("ends the session on a code that means the session is over", async () => {
    const { manager, refreshCall, store } = setup();
    refreshCall.mockRejectedValueOnce(
      new UnauthorizedError({ message: "reused", code: "TOKEN_REUSED", status: 401 }),
    );
    await login(manager);

    await expect(manager.refresh()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(manager.state).toEqual({ status: "unauthenticated", reason: "token_reused" });
    expect(await store.load()).toBeNull();
  });

  it("maps the other ending codes to their reason", async () => {
    const cases = [
      ["SESSION_REVOKED", "session_revoked"],
      ["ACCOUNT_SUSPENDED", "account_suspended"],
      ["REFRESH_TOKEN_INVALID", "session_expired"],
    ] as const;

    for (const [code, reason] of cases) {
      const { manager, refreshCall } = setup();
      refreshCall.mockRejectedValueOnce(new UnauthorizedError({ message: "x", code, status: 401 }));
      await login(manager);
      await manager.refresh().catch(() => undefined);
      expect(manager.state).toEqual({ status: "unauthenticated", reason });
    }
  });

  it("keeps the session and retries after 5, 15 seconds", async () => {
    const { manager, refreshCall } = setup();
    refreshCall.mockRejectedValueOnce(new NetworkError());
    refreshCall.mockRejectedValueOnce(new NetworkError());
    await login(manager);

    await expect(manager.refresh()).rejects.toBeInstanceOf(NetworkError);
    expect(manager.state).toEqual({ status: "authenticated" });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(refreshCall).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCall).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(refreshCall).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCall).toHaveBeenCalledTimes(3);
    expect(manager.state).toEqual({ status: "authenticated" });
  });

  it("waits one second and looks again on REFRESH_IN_PROGRESS", async () => {
    const { manager, refreshCall } = setup();
    refreshCall.mockRejectedValueOnce(
      new ConflictError({ message: "busy", code: "REFRESH_IN_PROGRESS", status: 409 }),
    );
    await login(manager);

    const done = manager.refresh();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;

    expect(refreshCall).toHaveBeenCalledTimes(2);
    expect(await manager.getAccessToken()).toBe("access-2");
  });
});

describe("recoverFromUnauthorized", () => {
  it("renews and replays the request on TOKEN_EXPIRED", async () => {
    const { manager, refreshCall } = setup();
    await login(manager);
    const { context, retry } = unauthorizedContext("TOKEN_EXPIRED");

    const response = await manager.recoverFromUnauthorized(context);
    expect(refreshCall).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(response?.data).toBe("replayed");
  });

  it("also recovers from UNAUTHORIZED while signed in", async () => {
    const { manager, refreshCall } = setup();
    await login(manager);

    await manager.recoverFromUnauthorized(unauthorizedContext("UNAUTHORIZED").context);
    expect(refreshCall).toHaveBeenCalledTimes(1);
  });

  it("leaves other 401 codes alone", async () => {
    const { manager, refreshCall } = setup();
    await login(manager);
    const { context, retry } = unauthorizedContext("TOKEN_INVALID");

    expect(await manager.recoverFromUnauthorized(context)).toBeUndefined();
    expect(refreshCall).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("does nothing when nobody is signed in", async () => {
    const { manager, refreshCall } = setup();
    const { context } = unauthorizedContext("TOKEN_EXPIRED");

    expect(await manager.recoverFromUnauthorized(context)).toBeUndefined();
    expect(refreshCall).not.toHaveBeenCalled();
  });

  it("does not renew again within 10 seconds of a renewal", async () => {
    const { manager, refreshCall } = setup();
    await login(manager);

    const first = unauthorizedContext("TOKEN_EXPIRED");
    await manager.recoverFromUnauthorized(first.context);
    const second = unauthorizedContext("TOKEN_EXPIRED");
    await manager.recoverFromUnauthorized(second.context);

    expect(refreshCall).toHaveBeenCalledTimes(1);
    expect(second.retry).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_001);
    await manager.recoverFromUnauthorized(unauthorizedContext("TOKEN_EXPIRED").context);
    expect(refreshCall).toHaveBeenCalledTimes(2);
  });

  it("surfaces the refresh error when renewing fails", async () => {
    const { manager, refreshCall } = setup();
    refreshCall.mockRejectedValueOnce(new NetworkError());
    await login(manager);

    await expect(
      manager.recoverFromUnauthorized(unauthorizedContext("TOKEN_EXPIRED").context),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("with the HTTP client", () => {
  it("replays a request once, with the new token, after an expired access token", async () => {
    const { manager, refreshCall, config } = setup();
    await login(manager);

    const client = createHttpClient({
      config,
      getAccessToken: () => manager.getAccessToken(),
      recoverFromUnauthorized: (context) => manager.recoverFromUnauthorized(context),
    });

    const seen: Array<string | undefined> = [];
    client.defaults.adapter = async (request) => {
      const header = request.headers.get("Authorization");
      seen.push(typeof header === "string" ? header : undefined);
      if (seen.length === 1) {
        throw new AxiosError("expired", "ERR_BAD_REQUEST", request, null, {
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config: request,
          data: { error: { code: "TOKEN_EXPIRED", message: "expired" } },
        });
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config: request };
    };

    const response = await client.get("/auth/me");
    expect(response.data).toEqual({ ok: true });
    expect(seen).toEqual(["Bearer access-1", "Bearer access-2"]);
    expect(refreshCall).toHaveBeenCalledTimes(1);
  });
});
