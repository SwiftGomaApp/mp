import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  ConflictError,
  NetworkError,
  NotAuthenticatedError,
  REFRESH_TOKEN_STORAGE_KEY,
  ServerError,
  TooManyRequestsError,
  UnauthorizedError,
  createHttpClient,
  createMemoryStorage,
  createRefreshManager,
  createSessionStore,
  readJwtExpiry,
} from "../src/index";
import type { Platform } from "../src/index";

type Reply = { status: number; data?: unknown } | Error;

function scripted(replies: Reply[]): { adapter: AxiosAdapter; sent: InternalAxiosRequestConfig[] } {
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    sent.push(config);
    const reply = replies.shift() ?? { status: 500, data: {} };
    if (reply instanceof Error) {
      return Promise.reject(new AxiosError(reply.message, "ERR_NETWORK", config));
    }
    const response = {
      status: reply.status,
      statusText: "",
      data: reply.data,
      headers: new AxiosHeaders(),
      config,
    };
    if (reply.status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError("failed", "ERR_BAD_RESPONSE", config, undefined, response),
    );
  };
  return { adapter, sent };
}

const fail = (status: number, code: string): Reply => ({
  status,
  data: { error: { code, message: code } },
});

const rotated = { accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 900 };

async function setup(platform: Platform, replies: Reply[]) {
  const { adapter, sent } = scripted(replies);
  const storage = createMemoryStorage();
  const store = createSessionStore({ platform, storage }, { now: () => 1_000 });
  const client = createHttpClient({ baseUrl: "https://api.example.com", adapter });
  const sleep = vi.fn(() => Promise.resolve());
  const manager = createRefreshManager({ client, platform, store, sleep });
  const ended: string[] = [];
  manager.onSessionEnded((reason) => ended.push(reason));

  if (platform === "WEB") {
    await store.signIn({ id: "u1" });
  } else {
    await store.signIn({ id: "u1" }, { accessToken: "access-1", refreshToken: "refresh-1" });
  }
  return { manager, store, storage, sent, sleep, ended };
}

describe("a mobile refresh", () => {
  it("sends the refresh token and keeps the new tokens", async () => {
    const { manager, store, storage, sent } = await setup("ANDROID", [
      { status: 200, data: rotated },
    ]);
    await manager.refreshNow();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("/auth/refresh");
    expect(sent[0]?.method).toBe("post");
    expect(JSON.parse(String(sent[0]?.data))).toEqual({ refreshToken: "refresh-1" });
    expect(store.getAccessToken()).toBe("access-2");
    expect(store.getRefreshToken()).toBe("refresh-2");
    expect(store.getState()).toMatchObject({
      status: "authenticated",
      accessExpiresAt: 1_000 + 900_000,
    });
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-2");
    expect(await storage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toContain("access-2");
  });

  it("shares one request between callers that ask at the same time", async () => {
    const { manager, sent } = await setup("IOS", [{ status: 200, data: rotated }]);
    await Promise.all([manager.refreshNow(), manager.refreshNow(), manager.refreshNow()]);
    expect(sent).toHaveLength(1);
  });

  it("makes a new request for a later call", async () => {
    const { manager, sent } = await setup("IOS", [
      { status: 200, data: rotated },
      { status: 200, data: { accessToken: "access-3", refreshToken: "refresh-3", expiresIn: 900 } },
    ]);
    await manager.refreshNow();
    await manager.refreshNow();
    expect(sent).toHaveLength(2);
    expect(JSON.parse(String(sent[1]?.data))).toEqual({ refreshToken: "refresh-2" });
  });

  it("lets every waiting caller see a failure, then allows a new try", async () => {
    const { manager, sent } = await setup("IOS", [
      fail(500, "INTERNAL_ERROR"),
      { status: 200, data: rotated },
    ]);
    const results = await Promise.allSettled([manager.refreshNow(), manager.refreshNow()]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(sent).toHaveLength(1);
    await manager.refreshNow();
    expect(sent).toHaveLength(2);
  });

  it("ends the session when there is no refresh token", async () => {
    const { manager, store, ended, sent } = await setup("ANDROID", []);
    await store.clear();
    ended.length = 0;
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(NotAuthenticatedError);
    expect(sent).toHaveLength(0);
    expect(ended).toEqual(["NOT_AUTHENTICATED"]);
  });

  it("treats an answer without tokens as a failure that may pass", async () => {
    const { manager, store, ended } = await setup("ANDROID", [{ status: 200, data: { ok: true } }]);
    await expect(manager.refreshNow()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
    expect(store.getRefreshToken()).toBe("refresh-1");
    expect(ended).toEqual([]);
  });
});

describe("a browser refresh", () => {
  it("sends no token, because the cookie carries it", async () => {
    const { manager, store, sent, storage } = await setup("WEB", [
      { status: 200, data: { expiresIn: 900 } },
    ]);
    await manager.refreshNow();

    expect(JSON.parse(String(sent[0]?.data))).toEqual({});
    expect(store.getAccessToken()).toBeNull();
    expect(store.getState().accessExpiresAt).toBe(1_000 + 900_000);
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("assumes the usual 15 minutes when the server does not say how long the token lasts", async () => {
    const { manager, store } = await setup("WEB", [{ status: 200, data: {} }]);
    await manager.refreshNow();
    expect(store.getState().accessExpiresAt).toBe(1_000 + 900_000);
    expect(store.getState().status).toBe("authenticated");
  });
});

describe("when the server refuses the session", () => {
  it.each([
    [401, "REFRESH_TOKEN_INVALID"],
    [401, "REFRESH_TOKEN_MISSING"],
    [401, "TOKEN_REUSED"],
    [401, "SESSION_EXPIRED"],
    [401, "SESSION_REVOKED"],
    [403, "ACCOUNT_SUSPENDED"],
  ])("ends the session on %i %s", async (status, code) => {
    const { manager, store, storage, ended } = await setup("ANDROID", [fail(status, code)]);
    await expect(manager.refreshNow()).rejects.toMatchObject({ code, status });

    expect(store.getState().status).toBe("anonymous");
    expect(store.getAccessToken()).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(ended).toEqual([code]);
  });

  it("throws the typed error", async () => {
    const { manager } = await setup("ANDROID", [fail(401, "REFRESH_TOKEN_INVALID")]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("ends a browser session too", async () => {
    const { manager, store, ended } = await setup("WEB", [fail(401, "REFRESH_TOKEN_MISSING")]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(store.getState().status).toBe("anonymous");
    expect(ended).toEqual(["REFRESH_TOKEN_MISSING"]);
  });

  it("leaves a newer session alone when an old refresh is refused", async () => {
    const { manager, store, ended } = await setup("ANDROID", [fail(401, "REFRESH_TOKEN_INVALID")]);
    const refresh = manager.refreshNow();
    await store.signIn({ id: "u2" }, { accessToken: "access-9", refreshToken: "refresh-9" });
    await expect(refresh).rejects.toBeInstanceOf(UnauthorizedError);

    expect(store.getState().user).toEqual({ id: "u2" });
    expect(store.getRefreshToken()).toBe("refresh-9");
    expect(ended).toEqual([]);
  });

  it("does not break when an end listener throws", async () => {
    const { manager, store } = await setup("ANDROID", [fail(401, "TOKEN_REUSED")]);
    manager.onSessionEnded(() => {
      throw new Error("bad listener");
    });
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(store.getState().status).toBe("anonymous");
  });
});

describe("when the refresh fails for a reason that may pass", () => {
  it("keeps the session when there is no network", async () => {
    const { manager, store, ended } = await setup("ANDROID", [new Error("offline")]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(NetworkError);
    expect(store.getState().status).toBe("authenticated");
    expect(store.getRefreshToken()).toBe("refresh-1");
    expect(ended).toEqual([]);
  });

  it("keeps the session when the server is down", async () => {
    const { manager, store } = await setup("ANDROID", [fail(503, "SERVICE_UNAVAILABLE")]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(ServerError);
    expect(store.getState().status).toBe("authenticated");
  });

  it("keeps the session when the rate limit is hit", async () => {
    const { manager, store } = await setup("ANDROID", [fail(429, "TOO_MANY_REQUESTS")]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(TooManyRequestsError);
    expect(store.getState().status).toBe("authenticated");
  });
});

describe("when another refresh is already running", () => {
  it("waits a little and tries again", async () => {
    const { manager, store, sent, sleep } = await setup("WEB", [
      fail(409, "REFRESH_IN_PROGRESS"),
      fail(409, "REFRESH_IN_PROGRESS"),
      { status: 200, data: { expiresIn: 900 } },
    ]);
    await manager.refreshNow();

    expect(sent).toHaveLength(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 300);
    expect(sleep).toHaveBeenNthCalledWith(2, 600);
    expect(store.getState().accessExpiresAt).toBe(1_000 + 900_000);
  });

  it("gives up after the retries and keeps the session", async () => {
    const { manager, store, sent } = await setup("WEB", [
      fail(409, "REFRESH_IN_PROGRESS"),
      fail(409, "REFRESH_IN_PROGRESS"),
      fail(409, "REFRESH_IN_PROGRESS"),
      { status: 200, data: {} },
    ]);
    await expect(manager.refreshNow()).rejects.toBeInstanceOf(ConflictError);
    expect(sent).toHaveLength(3);
    expect(store.getState().status).toBe("authenticated");
  });
});

describe("readJwtExpiry and stored expiry", () => {
  const base64Url = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = (claims: object): string =>
    `${base64Url({ alg: "HS256" })}.${base64Url(claims)}.signature`;

  it("reads exp from a token", () => {
    expect(readJwtExpiry(jwt({ sub: "u1", exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it.each([
    "",
    "abc",
    "a.b",
    "a.!!!.c",
    `a.${base64Url({ sub: "u1" })}.c`,
    `a.${base64Url({ exp: "soon" })}.c`,
  ])("returns null for %j", (token) => {
    expect(readJwtExpiry(token)).toBeNull();
  });

  it("is used when the server does not say how long a mobile token lasts", async () => {
    const store = createSessionStore({ platform: "ANDROID", storage: createMemoryStorage() });
    await store.signIn(
      { id: "u1" },
      { accessToken: jwt({ exp: 1_800_000_000 }), refreshToken: "refresh-1" },
    );
    expect(store.getState().accessExpiresAt).toBe(1_800_000_000_000);
  });

  it("is used when the tokens are read back from storage", async () => {
    const accessToken = jwt({ exp: 1_800_000_000 });
    const storage = createMemoryStorage({
      [REFRESH_TOKEN_STORAGE_KEY]: "refresh-1",
      [ACCESS_TOKEN_STORAGE_KEY]: JSON.stringify({ token: accessToken, expiresAt: null }),
    });
    const store = createSessionStore({ platform: "IOS", storage });
    await store.hydrate();
    expect(store.getState().accessExpiresAt).toBe(1_800_000_000_000);
  });
});
