import { beforeEach, describe, expect, it } from "vitest";
import { FakeRedis } from "../helpers/fakeRedis.mjs";
import { loadWithMocks } from "../helpers/mockModules.mjs";

let redis;
let settings;

const redisMock = { "core/cache/redis.js": { getRedis: () => redis } };
const configMock = {
  "config/env.config.js": {
    getConfig: () => ({
      auth: settings,
      sms: { dailyOtpLimit: settings.dailyOtpLimit },
      isProd: settings.isProd,
    }),
  },
};

const nonce = loadWithMocks("core/auth/nonce.js", redisMock);
const revocation = loadWithMocks("core/auth/revocation.js", { ...redisMock, ...configMock });
const smsBudget = loadWithMocks("core/messaging/smsBudget.js", { ...redisMock, ...configMock });
const otp = loadWithMocks("core/auth/otp.js", { ...redisMock, ...configMock });
const cookies = loadWithMocks("core/auth/cookies.js", configMock);

beforeEach(() => {
  redis = new FakeRedis();
  settings = {
    accessTtlSeconds: 900,
    refreshTtlDays: 7,
    otpTtlMinutes: 10,
    otpResendSeconds: 60,
    otpMaxAttempts: 3,
    otpMaxPerHour: 5,
    otpSecret: "o".repeat(40),
    dailyOtpLimit: 3,
    isProd: false,
  };
});

describe("OAuth nonces", () => {
  it("are random, stored hashed and expire after ten minutes", async () => {
    const value = await nonce.issueNonce();
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const keys = [...redis.values.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain(value);
    expect(await redis.ttl(keys[0])).toBeGreaterThan(590);
  });

  it("can be consumed once", async () => {
    const value = await nonce.issueNonce();
    await expect(nonce.consumeNonce(value, "NOPE")).resolves.toBeUndefined();
    await expect(nonce.consumeNonce(value, "NOPE")).rejects.toMatchObject({
      status: 401,
      code: "NOPE",
    });
  });

  it("refuses values that were never issued or are not strings", async () => {
    await expect(nonce.consumeNonce("never-issued", "X")).rejects.toMatchObject({ code: "X" });
    await expect(nonce.consumeNonce(undefined, "X")).rejects.toMatchObject({ code: "X" });
    await expect(nonce.consumeNonce(42, "X")).rejects.toMatchObject({ code: "X" });
  });
});

describe("session revocation markers", () => {
  it("flag a session for as long as its access token could live", async () => {
    expect(await revocation.isSessionRevoked("s1")).toBe(false);
    await revocation.markSessionRevoked("s1");
    expect(await revocation.isSessionRevoked("s1")).toBe(true);
    expect(await revocation.isSessionRevoked("s2")).toBe(false);
    expect(await redis.ttl("revoked-session:s1")).toBeGreaterThan(890);
  });
});

describe("daily SMS budget", () => {
  it("lets messages through until the daily limit", async () => {
    for (let i = 0; i < 3; i += 1) await smsBudget.assertSmsBudget();
    await expect(smsBudget.assertSmsBudget()).rejects.toMatchObject({
      status: 429,
      code: "SMS_BUDGET_EXCEEDED",
    });
  });

  it("is switched off with a limit of zero", async () => {
    settings.dailyOtpLimit = 0;
    for (let i = 0; i < 10; i += 1) await smsBudget.assertSmsBudget();
    expect(redis.values.size).toBe(0);
  });

  it("counts per day", async () => {
    await smsBudget.assertSmsBudget();
    const [key] = [...redis.values.keys()];
    expect(key).toBe(`sms-budget:otp:${new Date().toISOString().slice(0, 10)}`);
  });
});

describe("one-time codes", () => {
  it("accepts the code that was issued, once", async () => {
    const { code, expiresMinutes } = await otp.issueOtp({
      purpose: "login",
      target: "a@example.com",
    });
    expect(code).toMatch(/^\d{6}$/);
    expect(expiresMinutes).toBe(10);

    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code }),
    ).resolves.toBeUndefined();
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code }),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("stores only a keyed hash of the code", async () => {
    const { code } = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    const stored = [...redis.hashes.values()][0].get("hash");
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).not.toContain(code);
  });

  it("rejects a wrong code and counts the attempt", async () => {
    const { code } = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code: wrong }),
    ).rejects.toMatchObject({ status: 400, code: "OTP_INVALID" });
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code }),
    ).resolves.toBeUndefined();
  });

  it("burns the code after too many wrong attempts", async () => {
    const { code } = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i += 1) {
      await expect(
        otp.verifyOtp({ purpose: "login", target: "a@example.com", code: wrong }),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
    }
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code }),
    ).rejects.toMatchObject({ status: 429, code: "OTP_ATTEMPTS_EXCEEDED" });
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code }),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("is tied to its purpose and its target", async () => {
    const { code } = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    await expect(
      otp.verifyOtp({ purpose: "signup", target: "a@example.com", code }),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
    await expect(
      otp.verifyOtp({ purpose: "login", target: "b@example.com", code }),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("treats case and spaces in the target as the same contact", async () => {
    const { code } = await otp.issueOtp({ purpose: "login", target: "+243 89 123 4567" });
    await expect(
      otp.verifyOtp({ purpose: "login", target: "+243891234567", code: ` ${code} ` }),
    ).resolves.toBeUndefined();
  });

  it("makes a new request wait for the cooldown", async () => {
    await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    await expect(otp.issueOtp({ purpose: "login", target: "a@example.com" })).rejects.toMatchObject(
      {
        status: 429,
        code: "OTP_COOLDOWN",
        details: { retryAfterSeconds: expect.any(Number) },
      },
    );
    await expect(
      otp.issueOtp({ purpose: "signup", target: "a@example.com" }),
    ).resolves.toBeDefined();
  });

  it("replaces the previous code when a new one is issued", async () => {
    settings.otpResendSeconds = 0;
    const first = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    const second = await otp.issueOtp({ purpose: "login", target: "a@example.com" });
    if (first.code !== second.code) {
      await expect(
        otp.verifyOtp({ purpose: "login", target: "a@example.com", code: first.code }),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
    }
    await expect(
      otp.verifyOtp({ purpose: "login", target: "a@example.com", code: second.code }),
    ).resolves.toBeUndefined();
  });

  it("caps the codes sent to one contact per hour", async () => {
    settings.otpResendSeconds = 0;
    for (let i = 0; i < 5; i += 1)
      await otp.issueOtp({ purpose: `p${i}`, target: "a@example.com" });
    await expect(otp.issueOtp({ purpose: "p9", target: "a@example.com" })).rejects.toMatchObject({
      status: 429,
      code: "OTP_HOURLY_LIMIT",
    });
  });
});

describe("authentication cookies", () => {
  function response() {
    const calls = { set: [], cleared: [] };
    return {
      calls,
      cookie: (name, value, options) => calls.set.push({ name, value, options }),
      clearCookie: (name, options) => calls.cleared.push({ name, options }),
    };
  }

  it("keeps both tokens out of reach of scripts", () => {
    const res = response();
    cookies.setAuthCookies(res, { accessToken: "access", refreshToken: "refresh" });

    const access = res.calls.set.find((c) => c.name === "__Host-swg_access");
    const refresh = res.calls.set.find((c) => c.name === "swg_refresh");
    expect(access.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(access.options.maxAge).toBe(900_000);
    expect(refresh.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("marks the refresh cookie secure in production only", () => {
    const dev = response();
    cookies.setAuthCookies(dev, { accessToken: "a", refreshToken: "r" });
    expect(dev.calls.set.find((c) => c.name === "swg_refresh").options.secure).toBe(false);

    settings.isProd = true;
    const prod = response();
    cookies.setAuthCookies(prod, { accessToken: "a", refreshToken: "r" });
    expect(prod.calls.set.find((c) => c.name === "swg_refresh").options.secure).toBe(true);
  });

  it("clears both cookies with the same scope they were set with", () => {
    const res = response();
    cookies.clearAuthCookies(res);
    expect(res.calls.cleared.map((c) => c.name).sort()).toEqual([
      "__Host-swg_access",
      "swg_refresh",
    ]);
    expect(res.calls.cleared.find((c) => c.name === "swg_refresh").options.path).toBe(
      "/api/v1/auth",
    );
  });
});
