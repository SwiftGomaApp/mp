import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  createAuth,
  createMemoryStorage,
} from "../src/index";
import type { AuthAdapter, KeyValueStorage, Platform } from "../src/index";

const START = 1_000_000_000_000;
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  // No random head start, so the refresh falls exactly on the margin.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type Reply = { status: number; data?: unknown } | Error;

interface Seen {
  method: string;
  url: string;
  baseURL: string;
  auth: string | undefined;
  withCredentials: boolean;
  timeout: number;
}

const fail = (status: number, code: string): Reply => ({
  status,
  data: { error: { code, message: code } },
});

function server(answer: (seen: Seen) => Reply): { transport: AxiosAdapter; calls: Seen[] } {
  const calls: Seen[] = [];
  const transport: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const seen: Seen = {
      method: String(config.method),
      url: String(config.url),
      baseURL: String(config.baseURL),
      auth: config.headers.get("Authorization")?.toString(),
      withCredentials: Boolean(config.withCredentials),
      timeout: Number(config.timeout),
    };
    calls.push(seen);
    const reply = answer(seen);
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
  return { transport, calls };
}

const adapterFor = (platform: Platform, storage: KeyValueStorage): AuthAdapter => ({
  platform,
  storage,
});

// What the last run left in storage: a signed-in phone whose access token has `seconds` left.
const savedSession = (seconds: number): Record<string, string> => ({
  [REFRESH_TOKEN_STORAGE_KEY]: "refresh-1",
  [ACCESS_TOKEN_STORAGE_KEY]: JSON.stringify({
    token: "access-1",
    expiresAt: START + seconds * 1000,
  }),
});

const rotated = (n: number): Reply => ({
  status: 200,
  data: { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 },
});

describe("createAuth: setup", () => {
  it("needs an address and an adapter", () => {
    const adapter = adapterFor("ANDROID", createMemoryStorage());
    expect(() => createAuth({ baseUrl: "", adapter })).toThrow(TypeError);
    expect(() => createAuth({ baseUrl: undefined as unknown as string, adapter })).toThrow(
      /baseUrl/,
    );
    expect(() =>
      createAuth({
        baseUrl: "https://api.example.com",
        adapter: undefined as unknown as AuthAdapter,
      }),
    ).toThrow(/adapter/);
  });

  it("builds the client for the API", async () => {
    const { transport, calls } = server(() => ({ status: 200, data: {} }));
    const auth = createAuth({
      baseUrl: "https://api.example.com/",
      adapter: adapterFor("ANDROID", createMemoryStorage()),
      transport,
      requestTimeoutMs: 5000,
    });
    await auth.api.get("/health");
    expect(calls[0]).toMatchObject({
      baseURL: "https://api.example.com/api/v1",
      timeout: 5000,
      withCredentials: false,
    });
  });

  it("sends cookies from a browser and not from a phone", async () => {
    const web = server(() => ({ status: 200, data: {} }));
    await createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("WEB", createMemoryStorage()),
      transport: web.transport,
    }).api.get("/x");
    expect(web.calls[0]?.withCredentials).toBe(true);
    expect(web.calls[0]?.auth).toBeUndefined();
  });

  it("exposes the device identity of the adapter", async () => {
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: { ...adapterFor("IOS", createMemoryStorage()), getDeviceName: () => "iPhone 15" },
    });
    expect(await auth.device.get()).toMatchObject({ platform: "IOS", deviceName: "iPhone 15" });
  });
});

describe("createAuth: starting", () => {
  it("finds the session from the last run", async () => {
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(600))),
    });
    expect(auth.session.getState().status).toBe("unknown");
    await auth.start();

    expect(await auth.session.getAccessToken()).toBe("access-1");
    expect(auth.session.getState().accessExpiresAt).toBe(START + 600_000);
  });

  it("knows nobody is signed in when storage is empty", async () => {
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage()),
    });
    await auth.start();
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await auth.session.getAccessToken()).toBeNull();
  });

  it("reads storage once however many times it is called", async () => {
    const storage = createMemoryStorage(savedSession(600));
    const getItem = vi.spyOn(storage, "getItem");
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", storage),
    });
    await Promise.all([auth.start(), auth.start()]);
    await auth.start();
    expect(getItem).toHaveBeenCalledTimes(2); // the refresh token and the access token
  });

  it("can be called again after storage failed", async () => {
    const storage = createMemoryStorage(savedSession(600));
    const real = storage.getItem.bind(storage);
    let locked = true;
    storage.getItem = (key) => (locked ? Promise.reject(new Error("keychain locked")) : real(key));
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", storage),
    });

    await expect(auth.start()).rejects.toThrow("keychain locked");
    locked = false;
    await auth.start();
    expect(await auth.session.getAccessToken()).toBe("access-1");
  });
});

describe("createAuth: the session stays alive", () => {
  it("sends the token and renews it in the background", async () => {
    const { transport, calls } = server((seen) =>
      seen.url === "/auth/refresh" ? rotated(2) : { status: 200, data: { ok: true } },
    );
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
    });
    await auth.start();

    await auth.api.get("/orders");
    expect(calls[0]?.auth).toBe("Bearer access-1");

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(calls.filter((c) => c.url === "/auth/refresh")).toHaveLength(1);

    await auth.api.get("/orders");
    expect(calls[calls.length - 1]?.auth).toBe("Bearer access-2");
  });

  it("renews at the margin the app asks for", async () => {
    const { transport, calls } = server((seen) =>
      seen.url === "/auth/refresh" ? rotated(2) : { status: 200, data: {} },
    );
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
      refreshMarginSeconds: 600,
    });
    await auth.start();

    await vi.advanceTimersByTimeAsync(5 * MIN - 1);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.filter((c) => c.url === "/auth/refresh")).toHaveLength(1);
  });

  it("stops renewing when stopped", async () => {
    const { transport, calls } = server(() => rotated(2));
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
    });
    await auth.start();
    auth.stop();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(calls).toHaveLength(0);
  });

  it("recovers from an expired token on its own", async () => {
    const { transport, calls } = server((seen) => {
      if (seen.url === "/auth/refresh") return rotated(2);
      return seen.auth === "Bearer access-2"
        ? { status: 200, data: { ok: true } }
        : fail(401, "TOKEN_EXPIRED");
    });
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
    });
    await auth.start();

    expect((await auth.api.get("/orders")).data).toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual(["/orders", "/auth/refresh", "/orders"]);
  });

  it("tells listeners about new tokens, and about the end of the session", async () => {
    const { transport } = server((seen) =>
      seen.url === "/auth/refresh" ? rotated(2) : { status: 200, data: {} },
    );
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
    });
    const tokens: (string | null)[] = [];
    auth.session.onTokenRefreshed((token) => tokens.push(token));
    await auth.start();
    await auth.session.refreshNow();

    expect(tokens).toEqual(["access-1", "access-2"]);
    expect(auth.session.getState().accessExpiresAt).toBe(START + 900_000);
  });

  it("ends the session when the server refuses it", async () => {
    const { transport } = server(() => fail(401, "REFRESH_TOKEN_INVALID"));
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("ANDROID", createMemoryStorage(savedSession(900))),
      transport,
    });
    const ended: string[] = [];
    const tokens: (string | null)[] = [];
    const states: string[] = [];
    auth.session.onSessionEnded((reason) => ended.push(reason));
    auth.session.onTokenRefreshed((token) => tokens.push(token));
    auth.session.subscribe((state) => states.push(state.status));
    await auth.start();

    await expect(auth.session.refreshNow()).rejects.toMatchObject({
      code: "REFRESH_TOKEN_INVALID",
    });
    expect(ended).toEqual(["REFRESH_TOKEN_INVALID"]);
    expect(tokens[tokens.length - 1]).toBeNull();
    expect(states[states.length - 1]).toBe("anonymous");
  });

  it("refreshes a browser session through the cookie", async () => {
    const { transport, calls } = server(() => ({ status: 200, data: { expiresIn: 900 } }));
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: adapterFor("WEB", createMemoryStorage()),
      transport,
    });
    await auth.start();
    await auth.session.refreshNow();

    expect(calls[0]).toMatchObject({ url: "/auth/refresh", withCredentials: true });
    expect(auth.session.getState().accessExpiresAt).toBe(START + 900_000);
    expect(await auth.session.getAccessToken()).toBeNull();
  });
});
