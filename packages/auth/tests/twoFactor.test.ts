import { AxiosError } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/core/adapters";
import { createAuth, type Auth } from "../src/core/auth";
import { parseEnrollment, parseTwoFactorSetup } from "../src/core/mapping";
import { createMemoryStore } from "../src/core/memoryStore";

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
  role: "SUPPORT",
  status: "ACTIVE",
};
const challengeToken = "c".repeat(40);
const verifyChallenge = { twoFactorRequired: true, challengeToken, expiresIn: 300 };
const enrollChallenge = {
  twoFactorRequired: true,
  enrollment: true,
  challengeToken,
  expiresIn: 300,
};
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

function setup(platform: "ANDROID" | "WEB" = "ANDROID") {
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
  const auth = createAuth({ baseUrl: "https://api.example.com", adapter });
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

async function startVerifyLogin(ctx: ReturnType<typeof setup>) {
  ctx.replies.push({ status: 202, data: verifyChallenge });
  return ctx.auth.login.password({ email: "a@x.cd", password: "secret123" });
}

async function startEnrollLogin(ctx: ReturnType<typeof setup>) {
  ctx.replies.push({ status: 202, data: enrollChallenge });
  return ctx.auth.login.password({ email: "a@x.cd", password: "secret123" });
}

describe("two-step verification", () => {
  it("finishes a login with the app code", async () => {
    const ctx = setup();
    await startVerifyLogin(ctx);
    ctx.replies.push({ status: 200, data: mobileSession });

    const result = await ctx.auth.twoFactor.verify({ code: " 123456 " });

    expect(result).toEqual({ status: "authenticated", user, isNewDevice: true });
    expect(ctx.calls[1]).toMatchObject({
      url: "/auth/2fa/verify",
      body: { challengeToken, code: "123456" },
      authorization: undefined,
    });
    expect(ctx.auth.session.state).toEqual({ status: "authenticated" });
    expect((await ctx.store.load())?.refreshToken).toBe("refresh-1");
  });

  it("finishes a login with a backup code", async () => {
    const ctx = setup();
    await startVerifyLogin(ctx);
    ctx.replies.push({ status: 200, data: mobileSession });

    await ctx.auth.twoFactor.verify({ backupCode: "ABCD-EFGH" });

    expect(ctx.calls[1]?.body).toEqual({ challengeToken, backupCode: "ABCD-EFGH" });
  });

  it("works on the web, where the session lives in cookies", async () => {
    const ctx = setup("WEB");
    await startVerifyLogin(ctx);
    ctx.replies.push({ status: 200, data: { user, isNewDevice: false, expiresIn: 600 } });

    await ctx.auth.twoFactor.verify({ code: "123456" });

    expect((await ctx.store.load())?.accessToken).toBeNull();
    expect(ctx.auth.session.state).toEqual({ status: "authenticated" });
  });

  it("refuses without a pending second step, and sends nothing", async () => {
    const ctx = setup();

    await expect(ctx.auth.twoFactor.verify({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_CHALLENGE_EXPIRED",
    });
    expect(ctx.calls).toHaveLength(0);
  });

  it("keeps the challenge after a wrong code so the user can retry", async () => {
    const ctx = setup();
    await startVerifyLogin(ctx);
    ctx.replies.push({
      status: 401,
      data: { error: { code: "TWO_FACTOR_INVALID", message: "Code invalide" } },
    });
    ctx.replies.push({ status: 200, data: mobileSession });

    await expect(ctx.auth.twoFactor.verify({ code: "000000" })).rejects.toMatchObject({
      code: "TWO_FACTOR_INVALID",
    });
    expect(ctx.auth.session.state.status).not.toBe("authenticated");

    const result = await ctx.auth.twoFactor.verify({ code: "123456" });
    expect(result.status).toBe("authenticated");
  });

  it("forgets the challenge when the server says it expired", async () => {
    const ctx = setup();
    await startVerifyLogin(ctx);
    ctx.replies.push({
      status: 401,
      data: { error: { code: "TWO_FACTOR_CHALLENGE_EXPIRED", message: "Expiré" } },
    });

    await expect(ctx.auth.twoFactor.verify({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_CHALLENGE_EXPIRED",
    });
    expect(ctx.calls).toHaveLength(2);

    await expect(ctx.auth.twoFactor.verify({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_CHALLENGE_EXPIRED",
    });
    expect(ctx.calls).toHaveLength(2);
  });
});

describe("two-step enrollment", () => {
  it("sets up, confirms and returns the backup codes once", async () => {
    const ctx = setup();
    await startEnrollLogin(ctx);
    ctx.replies.push({
      status: 200,
      data: { secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/SwiftGoma:a@x.cd" },
    });
    ctx.replies.push({
      status: 200,
      data: { ...mobileSession, backupCodes: ["AAAA-1111", "BBBB-2222"] },
    });

    const setupResult = await ctx.auth.twoFactor.enroll.start();
    const confirmed = await ctx.auth.twoFactor.enroll.confirm({ code: "123456" });

    expect(setupResult).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/SwiftGoma:a@x.cd",
    });
    expect(confirmed).toEqual({
      user,
      isNewDevice: true,
      backupCodes: ["AAAA-1111", "BBBB-2222"],
    });
    expect(ctx.calls[1]).toMatchObject({
      url: "/auth/2fa/enroll/setup",
      body: { challengeToken },
      authorization: undefined,
    });
    expect(ctx.calls[2]).toMatchObject({
      url: "/auth/2fa/enroll/confirm",
      body: { challengeToken, code: "123456" },
    });
    expect(ctx.auth.session.state).toEqual({ status: "authenticated" });
  });

  it("does not open a session when the backup codes are missing", async () => {
    const ctx = setup();
    await startEnrollLogin(ctx);
    ctx.replies.push({ status: 200, data: mobileSession });

    await expect(ctx.auth.twoFactor.enroll.confirm({ code: "123456" })).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
    expect(ctx.auth.session.state.status).not.toBe("authenticated");
  });

  it("keeps the challenge after a wrong first code", async () => {
    const ctx = setup();
    await startEnrollLogin(ctx);
    ctx.replies.push({
      status: 401,
      data: { error: { code: "TWO_FACTOR_INVALID", message: "Code invalide" } },
    });
    ctx.replies.push({ status: 200, data: { ...mobileSession, backupCodes: ["AAAA-1111"] } });

    await expect(ctx.auth.twoFactor.enroll.confirm({ code: "000000" })).rejects.toMatchObject({
      code: "TWO_FACTOR_INVALID",
    });
    const confirmed = await ctx.auth.twoFactor.enroll.confirm({ code: "123456" });
    expect(confirmed.backupCodes).toEqual(["AAAA-1111"]);
  });
});

describe("wrong step", () => {
  it("asks to set up first when verify is used during enrollment", async () => {
    const ctx = setup();
    await startEnrollLogin(ctx);

    await expect(ctx.auth.twoFactor.verify({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_SETUP_REQUIRED",
    });
    expect(ctx.calls).toHaveLength(1);
  });

  it("refuses enrollment when the account only needs the second step", async () => {
    const ctx = setup();
    await startVerifyLogin(ctx);

    await expect(ctx.auth.twoFactor.enroll.start()).rejects.toMatchObject({
      code: "TWO_FACTOR_ALREADY_ENABLED",
    });
    await expect(ctx.auth.twoFactor.enroll.confirm({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_ALREADY_ENABLED",
    });
    expect(ctx.calls).toHaveLength(1);
  });
});

describe("two-step parsers", () => {
  it("reads the setup answer", () => {
    expect(parseTwoFactorSetup({ secret: "S", otpauthUri: "otpauth://x" })).toEqual({
      secret: "S",
      otpauthUri: "otpauth://x",
    });
    expect(() => parseTwoFactorSetup({ secret: "S" })).toThrow();
  });

  it("requires a session and a list of text codes for enrollment", () => {
    expect(parseEnrollment({ user, backupCodes: ["A"] }).backupCodes).toEqual(["A"]);
    expect(() => parseEnrollment({ user })).toThrow();
    expect(() => parseEnrollment({ user, backupCodes: [1] })).toThrow();
    expect(() => parseEnrollment({ twoFactorRequired: true, challengeToken: "c" })).toThrow();
  });
});
