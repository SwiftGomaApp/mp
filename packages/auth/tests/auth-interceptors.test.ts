import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import {
  NetworkError,
  UnauthorizedError,
  attachAuth,
  createHttpClient,
  createMemoryStorage,
  createRefreshManager,
  createSessionStore,
  createTokenScheduler,
} from "../src/index";
import type { Platform } from "../src/index";

type Reply = { status: number; data?: unknown } | Error;

interface Seen {
  method: string;
  url: string;
  auth: string | undefined;
  body: unknown;
}

const fail = (status: number, code: string): Reply => ({
  status,
  data: { error: { code, message: code } },
});

const rotated = (n: number): Reply => ({
  status: 200,
  data: { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 },
});

function fakeServer(answer: (seen: Seen, calls: Seen[]) => Reply): {
  adapter: AxiosAdapter;
  calls: Seen[];
} {
  const calls: Seen[] = [];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const seen: Seen = {
      method: String(config.method),
      url: String(config.url),
      auth: config.headers.get("Authorization")?.toString(),
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    };
    calls.push(seen);
    const reply = answer(seen, calls);
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
  return { adapter, calls };
}

async function setup(
  platform: Platform,
  answer: (seen: Seen, calls: Seen[]) => Reply,
  signedIn: { expiresInSeconds?: number } | null = {},
) {
  const { adapter, calls } = fakeServer(answer);
  const store = createSessionStore({ platform, storage: createMemoryStorage() });
  const client = createHttpClient({ baseUrl: "https://api.example.com", adapter });
  const manager = createRefreshManager({ client, platform, store });
  const refresh = vi.spyOn(manager, "refreshNow");
  const tokens = createTokenScheduler({ store, refresh: manager });
  const detach = attachAuth(client, { store, platform, tokens, refresh: manager });

  if (signedIn) {
    if (platform === "WEB") await store.signIn({ id: "u1" });
    else {
      await store.signIn(
        { id: "u1" },
        { accessToken: "access-1", refreshToken: "refresh-1", ...signedIn },
      );
    }
  }
  return { client, store, calls, refresh, detach };
}

const ok: Reply = { status: 200, data: { ok: true } };

describe("sending the access token", () => {
  it("adds the bearer token on mobile", async () => {
    const { client, calls } = await setup("ANDROID", () => ok, { expiresInSeconds: 900 });
    await client.get("/orders");
    expect(calls[0]?.auth).toBe("Bearer access-1");
  });

  it("sends nothing in a browser, where cookies do the work", async () => {
    const { client, calls } = await setup("WEB", () => ok);
    await client.get("/orders");
    expect(calls[0]?.auth).toBeUndefined();
  });

  it("sends nothing when nobody is signed in", async () => {
    const { client, calls } = await setup("ANDROID", () => ok, null);
    await client.get("/orders");
    expect(calls[0]?.auth).toBeUndefined();
  });

  it("keeps an Authorization header the app set itself", async () => {
    const { client, calls } = await setup("ANDROID", () => ok, { expiresInSeconds: 900 });
    await client.get("/orders", { headers: { Authorization: "Bearer mine" } });
    expect(calls[0]?.auth).toBe("Bearer mine");
  });

  it("does not put the access token on the refresh call", async () => {
    const { client, calls } = await setup(
      "ANDROID",
      (seen) => (seen.url === "/auth/refresh" ? rotated(2) : ok),
      { expiresInSeconds: 900 },
    );
    await client.post("/auth/refresh", { refreshToken: "refresh-1" });
    expect(calls[0]?.auth).toBeUndefined();
  });

  it("refreshes first when the token is about to expire", async () => {
    const { client, calls, refresh } = await setup(
      "ANDROID",
      (seen) => (seen.url === "/auth/refresh" ? rotated(2) : ok),
      { expiresInSeconds: 10 },
    );
    await client.get("/orders");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.url)).toEqual(["/auth/refresh", "/orders"]);
    expect(calls[1]?.auth).toBe("Bearer access-2");
  });

  it("does not send the request when its token expired and cannot be renewed", async () => {
    const { client, calls } = await setup(
      "ANDROID",
      (seen) => (seen.url === "/auth/refresh" ? new Error("offline") : ok),
      { expiresInSeconds: -10 },
    );
    await expect(client.get("/orders")).rejects.toBeInstanceOf(NetworkError);
    expect(calls.map((c) => c.url)).toEqual(["/auth/refresh"]);
  });
});

describe("the safety net for an expired token", () => {
  const expiredThenFine = (seen: Seen): Reply => {
    if (seen.url === "/auth/refresh") return rotated(2);
    return seen.auth === "Bearer access-2"
      ? { status: 200, data: { ok: true } }
      : fail(401, "TOKEN_EXPIRED");
  };

  it("refreshes and sends the request again with the new token", async () => {
    const { client, calls, refresh } = await setup("ANDROID", expiredThenFine, {
      expiresInSeconds: 900,
    });
    const response = await client.get("/orders");

    expect(response.data).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => [c.url, c.auth])).toEqual([
      ["/orders", "Bearer access-1"],
      ["/auth/refresh", undefined],
      ["/orders", "Bearer access-2"],
    ]);
  });

  it("sends a POST body again intact", async () => {
    const { client, calls } = await setup("ANDROID", (seen) =>
      seen.url === "/orders" && seen.auth === "Bearer access-1"
        ? fail(401, "TOKEN_EXPIRED")
        : seen.url === "/auth/refresh"
          ? rotated(2)
          : ok,
    );
    await client.post("/orders", { item: "bread", qty: 2 });
    expect(calls[2]?.body).toEqual({ item: "bread", qty: 2 });
    expect(calls[2]?.method).toBe("post");
  });

  it("does the same in a browser, where the dropped cookie gives UNAUTHORIZED", async () => {
    let refreshed = false;
    const { client, calls, refresh } = await setup("WEB", (seen) => {
      if (seen.url === "/auth/refresh") {
        refreshed = true;
        return { status: 200, data: { expiresIn: 900 } };
      }
      return refreshed ? ok : fail(401, "UNAUTHORIZED");
    });
    await client.get("/orders");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.url)).toEqual(["/orders", "/auth/refresh", "/orders"]);
  });

  it("tries only once: a second 401 is returned, not looped", async () => {
    const { client, calls, refresh } = await setup("ANDROID", (seen) =>
      seen.url === "/auth/refresh" ? rotated(2) : fail(401, "TOKEN_EXPIRED"),
    );
    await expect(client.get("/orders")).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
      status: 401,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(3);
  });

  it.each(["INVALID_CREDENTIALS", "SESSION_REVOKED", "TOKEN_INVALID", "TWO_FACTOR_INVALID"])(
    "does not refresh for 401 %s",
    async (code) => {
      const { client, calls, refresh } = await setup("ANDROID", () => fail(401, code));
      await expect(client.get("/orders")).rejects.toMatchObject({ code });
      expect(refresh).not.toHaveBeenCalled();
      expect(calls).toHaveLength(1);
    },
  );

  it.each([400, 403, 404, 500])("leaves a %i alone", async (status) => {
    const { client, refresh } = await setup("ANDROID", () => fail(status, "SOME_CODE"));
    await expect(client.get("/orders")).rejects.toMatchObject({ status });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not refresh when nobody is signed in", async () => {
    const { client, calls, refresh } = await setup(
      "ANDROID",
      () => fail(401, "UNAUTHORIZED"),
      null,
    );
    await expect(client.get("/orders")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(refresh).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("reports the end of the session when the refresh is refused", async () => {
    const { client, store, calls } = await setup("ANDROID", (seen) =>
      seen.url === "/auth/refresh"
        ? fail(401, "REFRESH_TOKEN_INVALID")
        : fail(401, "TOKEN_EXPIRED"),
    );
    await expect(client.get("/orders")).rejects.toMatchObject({
      code: "REFRESH_TOKEN_INVALID",
    });
    await expect(client.get("/orders")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(store.getState().status).toBe("anonymous");
    expect(calls.map((c) => c.url)).toEqual(["/orders", "/auth/refresh", "/orders"]);
  });

  it("reports a network failure of the refresh and keeps the session", async () => {
    const { client, store } = await setup("ANDROID", (seen) =>
      seen.url === "/auth/refresh" ? new Error("offline") : fail(401, "TOKEN_EXPIRED"),
    );
    await expect(client.get("/orders")).rejects.toBeInstanceOf(NetworkError);
    expect(store.getState().status).toBe("authenticated");
  });

  it("makes one refresh for requests that fail together", async () => {
    const { client, calls, refresh } = await setup("ANDROID", expiredThenFine);
    const results = await Promise.all([client.get("/a"), client.get("/b"), client.get("/c")]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.filter((c) => c.url === "/auth/refresh")).toHaveLength(1);
    expect(calls.filter((c) => c.auth === "Bearer access-2")).toHaveLength(3);
  });

  it("does not refresh again when another request already renewed the token", async () => {
    let renew: () => void = () => undefined;
    const { client, store, calls, refresh } = await setup("ANDROID", (seen) => {
      if (seen.auth !== "Bearer access-1") return ok;
      renew();
      return fail(401, "TOKEN_EXPIRED");
    });
    renew = () => {
      void store.updateTokens({
        accessToken: "access-9",
        refreshToken: "refresh-9",
        expiresInSeconds: 900,
      });
    };

    await client.get("/orders");
    expect(refresh).not.toHaveBeenCalled();
    expect(calls.map((c) => c.auth)).toEqual(["Bearer access-1", "Bearer access-9"]);
  });
});

describe("detach", () => {
  it("removes the interceptors", async () => {
    const { client, calls, detach } = await setup("ANDROID", () => ok, { expiresInSeconds: 900 });
    detach();
    await client.get("/orders");
    expect(calls[0]?.auth).toBeUndefined();
  });
});
