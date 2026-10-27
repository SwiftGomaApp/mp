import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { describe, expect, it, vi } from "vitest";
import type { PlatformAdapter } from "../src/core/adapters";
import { resolveConfig } from "../src/core/config";
import {
  ApiError,
  ForbiddenError,
  NetworkError,
  ServerError,
  TimeoutError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../src/core/errors";
import { createHttpClient, toApiError, type HttpClientOptions } from "../src/core/http";
import { createMemoryStore } from "../src/core/memoryStore";

type Reply = { status?: number; data?: unknown; headers?: Record<string, string> } | Error;

function fakeAdapter(handler: (config: InternalAxiosRequestConfig, call: number) => Reply) {
  const calls: InternalAxiosRequestConfig[] = [];

  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const reply = handler(config, calls.length);
    if (reply instanceof Error) throw reply;

    const response: AxiosResponse = {
      data: reply.data ?? {},
      status: reply.status ?? 200,
      statusText: "",
      headers: reply.headers ?? {},
      config,
      request: {},
    };
    if (response.status >= 400) {
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, response);
    }
    return response;
  };

  return { adapter, calls };
}

function platform(overrides: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    platform: "ANDROID",
    transport: "bearer",
    store: createMemoryStore(),
    lifecycle: { onForeground: () => () => {} },
    async getDeviceInfo() {
      return { deviceId: "device-12345", platform: "ANDROID" };
    },
    ...overrides,
  };
}

function build(
  handler: (config: InternalAxiosRequestConfig, call: number) => Reply,
  overrides: Partial<PlatformAdapter> = {},
  options: Partial<HttpClientOptions> = {},
) {
  const config = resolveConfig({
    baseUrl: "https://api.swiftgoma.com",
    adapter: platform(overrides),
  });
  const client = createHttpClient({ config, ...options });
  const { adapter, calls } = fakeAdapter(handler);
  client.defaults.adapter = adapter;
  return { client, calls };
}

const errorBody = (code: string, message = "Message", extra: Record<string, unknown> = {}) => ({
  error: { code, message, requestId: "req-1", ...extra },
});

describe("client setup", () => {
  it("targets the versioned API with a timeout and a JSON accept header", async () => {
    const { client, calls } = build(() => ({ data: { ok: true } }));
    const response = await client.get("/auth/me");

    expect(client.defaults.baseURL).toBe("https://api.swiftgoma.com/api/v1");
    expect(client.defaults.timeout).toBe(15_000);
    expect(calls[0]?.headers.get("Accept")).toBe("application/json");
    expect(response.data).toEqual({ ok: true });
  });

  it("sends credentials with every request in cookie mode only", () => {
    expect(
      build(() => ({}), { platform: "WEB", transport: "cookie" }).client.defaults.withCredentials,
    ).toBe(true);
    expect(build(() => ({})).client.defaults.withCredentials).toBe(false);
  });
});

describe("bearer mode", () => {
  it("attaches the access token", async () => {
    const { client, calls } = build(() => ({}), {}, { getAccessToken: () => "token-1" });
    await client.get("/auth/me");
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("waits for a token that is read asynchronously", async () => {
    const { client, calls } = build(() => ({}), {}, { getAccessToken: async () => "late-token" });
    await client.get("/auth/me");
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer late-token");
  });

  it("sends no header when there is no token", async () => {
    const { client, calls } = build(() => ({}), {}, { getAccessToken: () => null });
    await client.get("/auth/me");
    expect(calls[0]?.headers.has("Authorization")).toBe(false);
  });

  it("leaves out the token for calls marked skipAuth", async () => {
    const getAccessToken = vi.fn(() => "token-1");
    const { client, calls } = build(() => ({}), {}, { getAccessToken });
    await client.post("/auth/login/password", {}, { skipAuth: true } as never);
    expect(calls[0]?.headers.has("Authorization")).toBe(false);
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("does not replace an Authorization header the caller set", async () => {
    const { client, calls } = build(() => ({}), {}, { getAccessToken: () => "token-1" });
    await client.get("/x", { headers: { Authorization: "Bearer custom" } });
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer custom");
  });

  it("sends the stable User-Agent of the app", async () => {
    const { client, calls } = build(() => ({}), { userAgent: "SwiftGoma/1.0 (android)" });
    await client.get("/auth/me");
    expect(calls[0]?.headers.get("User-Agent")).toBe("SwiftGoma/1.0 (android)");
  });
});

describe("cookie mode", () => {
  it("never sets an Authorization header or a User-Agent", async () => {
    const getAccessToken = vi.fn(() => "token-1");
    const { client, calls } = build(
      () => ({}),
      { platform: "WEB", transport: "cookie", userAgent: "ignored" },
      { getAccessToken },
    );
    await client.get("/auth/me");

    expect(calls[0]?.headers.has("Authorization")).toBe(false);
    expect(calls[0]?.headers.has("User-Agent")).toBe(false);
    expect(getAccessToken).not.toHaveBeenCalled();
  });
});

describe("error mapping", () => {
  it.each([
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [422, ValidationError],
    [429, TooManyRequestsError],
    [500, ServerError],
  ])("turns a %i answer into the matching error", async (status, expected) => {
    const { client } = build(() => ({ status, data: errorBody("SOME_CODE", "Un message") }));
    const error = await client.get("/x").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(expected);
    const api = error as ApiError;
    expect(api.code).toBe("SOME_CODE");
    expect(api.message).toBe("Un message");
    expect(api.requestId).toBe("req-1");
    expect(api.cause).toBeInstanceOf(AxiosError);
  });

  it("reads the wait time of a rate-limited call from the headers", async () => {
    const { client } = build(() => ({ status: 429, headers: { "retry-after": "20" } }));
    const error = (await client
      .get("/x")
      .catch((caught: unknown) => caught)) as TooManyRequestsError;
    expect(error.retryAfterSeconds).toBe(20);
  });

  it("turns a missing answer into a network error that keeps the cause", async () => {
    const cause = new AxiosError("Network Error", "ERR_NETWORK");
    const { client } = build(() => cause);
    const error = await client.get("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).cause).toBe(cause);
  });

  it.each(["ECONNABORTED", "ETIMEDOUT"])("turns %s into a timeout", async (code) => {
    const { client } = build(() => new AxiosError("timeout", code));
    expect(await client.get("/x").catch((caught: unknown) => caught)).toBeInstanceOf(TimeoutError);
  });

  it("lets a cancellation through unchanged", async () => {
    const controller = new AbortController();
    const { client } = build((config) => {
      controller.abort();
      return new axios.CanceledError("canceled", config);
    });
    const error = await client
      .get("/x", { signal: controller.signal })
      .catch((caught: unknown) => caught);
    expect(axios.isCancel(error)).toBe(true);
  });

  it("does not hide errors that are not Axios errors", async () => {
    const bug = new TypeError("bug in the app");
    const { client } = build(() => bug);
    expect(await client.get("/x").catch((caught: unknown) => caught)).toBe(bug);
  });

  it("converts through toApiError directly", () => {
    const existing = new NetworkError();
    expect(toApiError(existing)).toBe(existing);
    expect(toApiError("text")).toBe("text");
  });
});

describe("recovering from a 401", () => {
  const expired = { status: 401, data: errorBody("TOKEN_EXPIRED", "Session expirée") };

  it("replays the request once with the renewed token", async () => {
    let token = "old-token";
    const recover = vi.fn(async ({ retry }: { retry(): Promise<AxiosResponse> }) => {
      token = "new-token";
      return retry();
    });
    const { client, calls } = build(
      (config, call) =>
        call === 1 ? expired : { data: { user: "ok", seen: config.headers.get("Authorization") } },
      {},
      { getAccessToken: () => token, recoverFromUnauthorized: recover },
    );

    const response = await client.get("/auth/me");

    expect(recover).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer old-token");
    expect(calls[1]?.headers.get("Authorization")).toBe("Bearer new-token");
    expect(response.data.user).toBe("ok");
  });

  it("keeps the body of a replayed request", async () => {
    const { client, calls } = build(
      (_config, call) => (call === 1 ? expired : {}),
      {},
      { getAccessToken: () => "t", recoverFromUnauthorized: ({ retry }) => retry() },
    );
    await client.post("/shops", { name: "Boutique" });
    expect(JSON.parse(String(calls[1]?.data))).toEqual({ name: "Boutique" });
  });

  it("stops after one replay if the second answer is also a 401", async () => {
    const recover = vi.fn(async ({ retry }: { retry(): Promise<AxiosResponse> }) => retry());
    const { client, calls } = build(() => expired, {}, { recoverFromUnauthorized: recover });

    const error = await client.get("/x").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it("lets the 401 through when nothing was recovered", async () => {
    const { client } = build(() => expired, {}, { recoverFromUnauthorized: async () => undefined });
    const error = await client.get("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).code).toBe("TOKEN_EXPIRED");
  });

  it("reports the failure of the renewal itself", async () => {
    const { client } = build(
      () => expired,
      {},
      {
        recoverFromUnauthorized: async () => {
          throw new NetworkError();
        },
      },
    );
    expect(await client.get("/x").catch((caught: unknown) => caught)).toBeInstanceOf(NetworkError);
  });

  it("does not try for calls marked skipAuth, other statuses or without a hook", async () => {
    const recover = vi.fn(async () => undefined);

    const skipped = build(() => expired, {}, { recoverFromUnauthorized: recover });
    await skipped.client
      .post("/auth/login/password", {}, { skipAuth: true } as never)
      .catch(() => {});

    const forbidden = build(() => ({ status: 403 }), {}, { recoverFromUnauthorized: recover });
    await forbidden.client.get("/x").catch(() => {});

    expect(recover).not.toHaveBeenCalled();

    const plain = build(() => expired);
    expect(await plain.client.get("/x").catch((caught: unknown) => caught)).toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
