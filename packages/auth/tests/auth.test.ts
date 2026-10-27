import { AxiosError } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/core/adapters";
import { createAuth, type Auth } from "../src/core/auth";
import { ServerError, UnauthorizedError } from "../src/core/errors";
import { createMemoryStore } from "../src/core/memoryStore";

type Reply = { status: number; data?: unknown } | { network: true };

interface Call {
  method: string;
  url: string;
  body: unknown;
  authorization: string | undefined;
}

const user = {
  id: "u1",
  name: "Aline",
  email: "a@x.cd",
  phone: "+243810000000",
  role: "BUYER",
  status: "ACTIVE",
};
const codeRequested = { method: "EMAIL", target: "a@x.cd", expiresMinutes: "10" };
const mobileSession = { user, accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 900 };

let current: Auth | null = null;

afterEach(() => {
  current?.destroy();
  current = null;
});

function setup(platform: "ANDROID" | "WEB" = "ANDROID") {
  const store = createMemoryStore();
  const adapter: PlatformAdapter = {
    platform,
    transport: platform === "WEB" ? "cookie" : "bearer",
    store,
    lifecycle: { onForeground: () => () => undefined },
    async getDeviceInfo() {
      return { deviceId: "device-12345", deviceName: "Pixel", platform };
    },
  };
  const auth = createAuth({ baseUrl: "https://api.example.com", adapter });
  current = auth;

  const calls: Call[] = [];
  const replies: Reply[] = [];

  auth.api.defaults.adapter = async (config) => {
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request ${config.method} ${config.url}`);

    const authorization = config.headers.get("Authorization");
    calls.push({
      method: String(config.method),
      url: String(config.url),
      body: typeof config.data === "string" ? JSON.parse(config.data) : undefined,
      authorization: typeof authorization === "string" ? authorization : undefined,
    });

    if ("network" in reply) throw new AxiosError("Network Error", "ERR_NETWORK", config);

    const response = {
      data: reply.data,
      status: reply.status,
      statusText: "",
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, response);
    }
    return response;
  };

  return { auth, store, calls, replies };
}

describe("sign-up", () => {
  it("starts an e-mail sign-up without an access token", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 201, data: codeRequested });

    const result = await auth.signup.email.start({
      name: "Aline",
      email: "a@x.cd",
      role: "BUYER",
      acceptTerms: true,
      confirmAge: true,
    });

    expect(result).toEqual(codeRequested);
    expect(calls[0]).toMatchObject({
      method: "post",
      url: "/auth/signup/email",
      authorization: undefined,
      body: {
        name: "Aline",
        email: "a@x.cd",
        role: "BUYER",
        acceptTerms: true,
        confirmAge: true,
      },
    });
  });

  it("starts a phone sign-up and resends the code", async () => {
    const { auth, calls, replies } = setup();
    replies.push({
      status: 201,
      data: { method: "PHONE", target: "+243810000000", expiresMinutes: 5 },
    });
    replies.push({ status: 200, data: { message: "Code renvoyé" } });

    const started = await auth.signup.phone.start({
      name: "Aline",
      phone: "+243810000000",
      role: "RIDER",
      acceptTerms: true,
      confirmAge: true,
    });
    const resent = await auth.signup.phone.resend({ phone: "+243810000000" });

    expect(started.expiresMinutes).toBe("5");
    expect(resent).toEqual({ message: "Code renvoyé" });
    expect(calls[0]?.url).toBe("/auth/signup/phone");
    expect(calls[1]).toMatchObject({
      url: "/auth/signup/resend",
      body: { phone: "+243810000000" },
    });
  });

  it("verifies the code, sends the device and opens the session", async () => {
    const { auth, store, calls, replies } = setup();
    replies.push({ status: 200, data: mobileSession });

    const result = await auth.signup.email.verify({ email: "a@x.cd", code: "123456" });

    expect(result).toEqual({ user });
    expect(calls[0]?.body).toEqual({
      email: "a@x.cd",
      code: "123456",
      device: { deviceId: "device-12345", deviceName: "Pixel", platform: "ANDROID" },
    });
    expect(auth.session.state).toEqual({ status: "authenticated" });
    expect((await store.load())?.refreshToken).toBe("refresh-1");
  });
});

describe("login", () => {
  it("requests and verifies an e-mail code", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 200, data: codeRequested });
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: true } });

    expect(await auth.login.emailCode.request({ email: "a@x.cd" })).toEqual(codeRequested);
    const result = await auth.login.emailCode.verify({ email: "a@x.cd", code: "123456" });

    expect(result).toEqual({ status: "authenticated", user, isNewDevice: true });
    expect(calls[0]).toMatchObject({ url: "/auth/login/otp/request", body: { email: "a@x.cd" } });
    expect(calls[1]?.url).toBe("/auth/login/otp/verify");
    expect(auth.session.state).toEqual({ status: "authenticated" });
  });

  it("lets a phone login ask for the code by e-mail", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 200, data: codeRequested });

    await auth.login.phoneCode.request({ phone: "+243810000000", channel: "EMAIL" });
    expect(calls[0]?.body).toEqual({ phone: "+243810000000", channel: "EMAIL" });
  });

  it("logs in with a password", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });

    const result = await auth.login.password({ email: "a@x.cd", password: "secret123" });

    expect(result).toMatchObject({ status: "authenticated", isNewDevice: false });
    expect(calls[0]).toMatchObject({
      url: "/auth/login/password",
      body: { email: "a@x.cd", password: "secret123", device: { platform: "ANDROID" } },
    });
  });

  it("returns the second-step result without opening a session", async () => {
    const { auth, replies } = setup();
    replies.push({
      status: 202,
      data: { twoFactorRequired: true, challengeToken: "c".repeat(40), expiresIn: 300 },
    });

    const result = await auth.login.password({ email: "a@x.cd", password: "secret123" });

    expect(result).toEqual({ status: "two_factor_required", challengeExpiresIn: 300 });
    expect(auth.session.state.status).not.toBe("authenticated");
  });

  it("returns the enrollment result for staff accounts", async () => {
    const { auth, replies } = setup();
    replies.push({
      status: 202,
      data: {
        twoFactorRequired: true,
        enrollment: true,
        challengeToken: "c".repeat(40),
        expiresIn: 300,
      },
    });

    const result = await auth.login.emailCode.verify({ email: "a@x.cd", code: "123456" });
    expect(result).toEqual({ status: "two_factor_enrollment_required", challengeExpiresIn: 300 });
  });

  it("surfaces a wrong password and opens no session", async () => {
    const { auth, replies } = setup();
    replies.push({
      status: 401,
      data: { error: { code: "INVALID_CREDENTIALS", message: "Identifiants invalides" } },
    });

    const attempt = auth.login.password({ email: "a@x.cd", password: "nope" });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(attempt).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(auth.session.state.status).not.toBe("authenticated");
  });

  it("rejects a mobile answer that has no tokens", async () => {
    const { auth, replies } = setup();
    replies.push({ status: 200, data: { user, isNewDevice: false } });

    await expect(
      auth.login.password({ email: "a@x.cd", password: "secret123" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
    expect(auth.session.state.status).not.toBe("authenticated");
  });

  it("keeps only the expiry on the web, where tokens live in cookies", async () => {
    const { auth, store, calls, replies } = setup("WEB");
    replies.push({ status: 200, data: { user, isNewDevice: true, expiresIn: 600 } });
    replies.push({ status: 200, data: { user: { ...user, sessionId: "s1" } } });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });
    await auth.me();

    const record = await store.load();
    expect(record?.accessToken).toBeNull();
    expect(record?.refreshToken).toBeNull();
    expect(record?.accessTokenExpiresAt).toBeGreaterThan(Date.now() + 590_000);
    expect(calls[0]?.body).toMatchObject({ device: { platform: "WEB" } });
    expect(calls[1]?.authorization).toBeUndefined();
  });
});

describe("session use", () => {
  it("sends the bearer token and returns the current user", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({ status: 200, data: { user: { ...user, sessionId: "s1" } } });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });
    const me = await auth.me();

    expect(me.id).toBe("u1");
    expect(calls[1]).toMatchObject({
      method: "get",
      url: "/auth/me",
      authorization: "Bearer access-1",
    });
  });

  it("renews an expired token and replays the request", async () => {
    const { auth, calls, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({
      status: 401,
      data: { error: { code: "TOKEN_EXPIRED", message: "Jeton expiré" } },
    });
    replies.push({
      status: 200,
      data: { accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 900 },
    });
    replies.push({ status: 200, data: { user: { ...user, sessionId: "s1" } } });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });
    await auth.me();

    expect(calls.map((call) => call.url)).toEqual([
      "/auth/login/password",
      "/auth/me",
      "/auth/refresh",
      "/auth/me",
    ]);
    expect(calls[2]?.body).toEqual({ refreshToken: "refresh-1" });
    expect(calls[2]?.authorization).toBeUndefined();
    expect(calls[3]?.authorization).toBe("Bearer access-2");
  });

  it("refuses me() and logoutAll() once signed out", async () => {
    const { auth } = setup();
    await auth.session.start();

    await expect(auth.me()).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(auth.logoutAll()).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});

describe("logout", () => {
  it("signs out on the server and on this device", async () => {
    const { auth, store, calls, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({ status: 204 });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });
    const result = await auth.logout();

    expect(result).toEqual({ serverRevoked: true });
    expect(calls[1]).toMatchObject({ url: "/auth/logout", authorization: "Bearer access-1" });
    expect(auth.session.state).toEqual({ status: "unauthenticated", reason: "logout" });
    expect(await store.load()).toBeNull();
  });

  it("still signs out on this device when the server cannot be reached", async () => {
    const { auth, store, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({ network: true });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });
    const result = await auth.logout();

    expect(result).toEqual({ serverRevoked: false });
    expect(auth.session.state.status).toBe("unauthenticated");
    expect(await store.load()).toBeNull();
  });

  it("signs out everywhere and reports how many sessions ended", async () => {
    const { auth, store, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({ status: 200, data: { revoked: 3 } });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });

    expect(await auth.logoutAll()).toEqual({ revoked: 3 });
    expect(auth.session.state.status).toBe("unauthenticated");
    expect(await store.load()).toBeNull();
  });

  it("keeps the session when logoutAll fails", async () => {
    const { auth, replies } = setup();
    replies.push({ status: 200, data: { ...mobileSession, isNewDevice: false } });
    replies.push({ status: 500, data: { error: { code: "INTERNAL_ERROR", message: "Erreur" } } });

    await auth.login.password({ email: "a@x.cd", password: "secret123" });

    await expect(auth.logoutAll()).rejects.toBeInstanceOf(ServerError);
    expect(auth.session.state).toEqual({ status: "authenticated" });
  });
});
