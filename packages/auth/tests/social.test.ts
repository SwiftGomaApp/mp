import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger, PlatformAdapter } from "../src/core/adapters";
import { createAuth, type Auth } from "../src/core/auth";
import type { SocialsConfig } from "../src/core/config";
import { SocialLoginDisabledError } from "../src/core/errors";
import { createMemoryStore } from "../src/core/memoryStore";
import { parseNonce } from "../src/core/mapping";

type Reply = { status: number; data?: unknown };

interface Call {
  url: string;
  body: Record<string, unknown> | undefined;
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
const nonce = "n".repeat(43);
const mobileSession = {
  user,
  accessToken: "access-1",
  refreshToken: "refresh-1",
  expiresIn: 900,
  isNewDevice: true,
};

let current: Auth | null = null;

afterEach(() => {
  current?.destroy();
  current = null;
});

function setup(
  options: { platform?: "ANDROID" | "IOS" | "WEB"; socials?: SocialsConfig; logger?: Logger } = {},
) {
  const platform = options.platform ?? "ANDROID";
  const store = createMemoryStore();
  const adapter: PlatformAdapter = {
    platform,
    transport: platform === "WEB" ? "cookie" : "bearer",
    store,
    lifecycle: { onForeground: () => () => undefined },
    async getDeviceInfo() {
      return { deviceId: "device-12345", platform };
    },
  };
  const auth = createAuth({
    baseUrl: "https://api.example.com",
    adapter,
    ...(options.socials ? { socials: options.socials } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  });
  current = auth;

  const calls: Call[] = [];
  const replies: Reply[] = [];

  auth.api.defaults.adapter = async (config) => {
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request ${config.method} ${config.url}`);

    const authorization = config.headers.get("Authorization");
    calls.push({
      url: String(config.url),
      body: typeof config.data === "string" ? JSON.parse(config.data) : undefined,
      authorization: typeof authorization === "string" ? authorization : undefined,
    });

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

function makeLogger() {
  const warn = vi.fn();
  const logger: Logger = { debug() {}, warn, error() {} };
  return { logger, warn };
}

describe("switches", () => {
  it("are off by default", async () => {
    const { auth, calls } = setup();
    const getIdToken = vi.fn(async () => "token");

    expect(auth.socials.enabled).toEqual([]);

    const attempt = auth.login.google({ getIdToken });
    await expect(attempt).rejects.toBeInstanceOf(SocialLoginDisabledError);
    await expect(attempt).rejects.toMatchObject({
      code: "SOCIAL_LOGIN_DISABLED",
      provider: "google",
    });
    expect(getIdToken).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("list what the app switched on", () => {
    expect(setup({ socials: { google: true } }).auth.socials.enabled).toEqual(["google"]);
    expect(setup({ socials: { apple: true } }).auth.socials.enabled).toEqual(["apple"]);
    expect(setup({ socials: { google: true, apple: true } }).auth.socials.enabled).toEqual([
      "google",
      "apple",
    ]);
  });

  it("disable only the provider that is off, for login and sign-up", async () => {
    const { auth, calls } = setup({ socials: { google: true } });
    const getIdToken = async () => "token";

    await expect(auth.login.apple({ getIdToken })).rejects.toMatchObject({ provider: "apple" });
    await expect(
      auth.signup.apple({ getIdToken, role: "BUYER", acceptTerms: true, confirmAge: true }),
    ).rejects.toBeInstanceOf(SocialLoginDisabledError);
    expect(calls).toHaveLength(0);
  });
});

describe("development warning", () => {
  it("warns for Google without Apple on iOS", () => {
    const { logger, warn } = makeLogger();
    setup({ platform: "IOS", socials: { google: true }, logger });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("guideline 4.8");
  });

  it("stays quiet when Apple is on, or off the iOS platform", () => {
    const both = makeLogger();
    setup({ platform: "IOS", socials: { google: true, apple: true }, logger: both.logger });
    expect(both.warn).not.toHaveBeenCalled();

    const android = makeLogger();
    setup({ platform: "ANDROID", socials: { google: true }, logger: android.logger });
    expect(android.warn).not.toHaveBeenCalled();

    const none = makeLogger();
    setup({ platform: "IOS", logger: none.logger });
    expect(none.warn).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  it("asks for a nonce, passes it to the app, then sends token and nonce", async () => {
    const { auth, store, calls, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });
    replies.push({ status: 200, data: mobileSession });
    const getIdToken = vi.fn(async () => " google-id-token ");

    const result = await auth.login.google({ getIdToken });

    expect(getIdToken).toHaveBeenCalledWith(nonce);
    expect(result).toEqual({ status: "authenticated", user, isNewDevice: true });
    expect(calls.map((call) => call.url)).toEqual(["/auth/oauth/nonce", "/auth/login/google"]);
    expect(calls[0]?.authorization).toBeUndefined();
    expect(calls[1]?.body).toEqual({
      idToken: "google-id-token",
      nonce,
      device: { deviceId: "device-12345", platform: "ANDROID" },
    });
    expect(auth.session.state).toEqual({ status: "authenticated" });
    expect((await store.load())?.refreshToken).toBe("refresh-1");
  });

  it("works for Apple", async () => {
    const { auth, calls, replies } = setup({ platform: "IOS", socials: { apple: true } });
    replies.push({ status: 200, data: { nonce } });
    replies.push({ status: 200, data: mobileSession });

    await auth.login.apple({ getIdToken: async () => "apple-id-token" });

    expect(calls[1]).toMatchObject({
      url: "/auth/login/apple",
      body: { idToken: "apple-id-token", nonce, device: { platform: "IOS" } },
    });
  });

  it("returns the second-step result when the account needs it", async () => {
    const { auth, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });
    replies.push({
      status: 202,
      data: { twoFactorRequired: true, challengeToken: "c".repeat(40), expiresIn: 300 },
    });

    const result = await auth.login.google({ getIdToken: async () => "token" });

    expect(result).toEqual({ status: "two_factor_required", challengeExpiresIn: 300 });
    expect(auth.session.state.status).not.toBe("authenticated");
  });

  it("lets the provider library's error through and sends no login request", async () => {
    const { auth, calls, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });

    await expect(
      auth.login.google({
        getIdToken: async () => {
          throw new Error("user cancelled");
        },
      }),
    ).rejects.toThrow("user cancelled");
    expect(calls).toHaveLength(1);
  });

  it("rejects an empty token before calling the server", async () => {
    const { auth, calls, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });

    await expect(auth.login.google({ getIdToken: async () => "  " })).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(calls).toHaveLength(1);
  });

  it("surfaces a server refusal and opens no session", async () => {
    const { auth, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });
    replies.push({
      status: 401,
      data: { error: { code: "GOOGLE_TOKEN_INVALID", message: "Jeton Google invalide" } },
    });

    await expect(auth.login.google({ getIdToken: async () => "token" })).rejects.toMatchObject({
      code: "GOOGLE_TOKEN_INVALID",
    });
    expect(auth.session.state.status).not.toBe("authenticated");
  });

  it("fails clearly when the nonce answer is malformed", async () => {
    const { auth, replies } = setup({ socials: { google: true } });
    const getIdToken = vi.fn(async () => "token");
    replies.push({ status: 200, data: {} });

    await expect(auth.login.google({ getIdToken })).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
    expect(getIdToken).not.toHaveBeenCalled();
  });
});

describe("sign-up", () => {
  it("sends role, terms and age confirmation with the Google token", async () => {
    const { auth, calls, replies } = setup({ socials: { google: true } });
    replies.push({ status: 200, data: { nonce } });
    replies.push({ status: 200, data: mobileSession });

    const result = await auth.signup.google({
      getIdToken: async () => "google-id-token",
      role: "SELLER",
      acceptTerms: true,
      confirmAge: true,
    });

    expect(result.status).toBe("authenticated");
    expect(calls[1]).toMatchObject({ url: "/auth/signup/google" });
    expect(calls[1]?.body).toEqual({
      idToken: "google-id-token",
      nonce,
      role: "SELLER",
      acceptTerms: true,
      confirmAge: true,
      device: { deviceId: "device-12345", platform: "ANDROID" },
    });
  });

  it("sends the Apple name only when it is given", async () => {
    const withName = setup({ platform: "IOS", socials: { apple: true } });
    withName.replies.push({ status: 200, data: { nonce } });
    withName.replies.push({ status: 200, data: mobileSession });
    await withName.auth.signup.apple({
      getIdToken: async () => "apple-id-token",
      role: "RIDER",
      acceptTerms: true,
      confirmAge: true,
      name: "  Aline Kabila ",
    });
    expect(withName.calls[1]?.body).toMatchObject({ name: "Aline Kabila", role: "RIDER" });

    const withoutName = setup({ platform: "IOS", socials: { apple: true } });
    withoutName.replies.push({ status: 200, data: { nonce } });
    withoutName.replies.push({ status: 200, data: mobileSession });
    await withoutName.auth.signup.apple({
      getIdToken: async () => "apple-id-token",
      role: "BUYER",
      acceptTerms: true,
      confirmAge: true,
    });
    expect(withoutName.calls[1]?.body).not.toHaveProperty("name");
  });
});

describe("parseNonce", () => {
  it("needs a non-empty text nonce", () => {
    expect(parseNonce({ nonce })).toBe(nonce);
    expect(() => parseNonce({})).toThrow();
    expect(() => parseNonce({ nonce: "" })).toThrow();
    expect(() => parseNonce({ nonce: 5 })).toThrow();
  });
});
