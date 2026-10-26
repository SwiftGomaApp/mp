import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const CONFIG_PATH = require.resolve("../../src/config/env.config.js");

const validEnv = {
  NODE_ENV: "test",
  SECRETS_PROVIDER: "env",
  API_BASE_URL: "http://localhost:4000",
  CORS_ORIGINS: "http://localhost:3000, http://localhost:3001",
  DATABASE_URL: "postgresql://u@localhost/db",
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  MAIL_FROM: "SwiftGoma <no-reply@example.com>",
  MAIL_LOGO_URL: "https://example.com/logo.png",
  MAIL_PRIVACY_URL: "https://example.com/privacy",
  AT_USERNAME: "sandbox",
  AT_API_KEY: "key",
  JWT_ACCESS_SECRET: "j".repeat(40),
  OTP_SECRET: "o".repeat(40),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

const saved = { ...process.env };

function freshConfigModule() {
  delete require.cache[CONFIG_PATH];
  return require(CONFIG_PATH);
}

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved) || ["NODE_ENV"].includes(key)) continue;
    delete process.env[key];
  }
  for (const key of Object.keys(validEnv)) delete process.env[key];
  for (const key of [
    "TRUST_PROXY",
    "OTP_MAX_PER_HOUR",
    "SMS_DRY_RUN",
    "PASSKEY_RP_ID",
    "PASSKEY_ORIGINS",
    "GOOGLE_CLIENT_IDS",
    "REFRESH_TOKEN_TTL_DAYS",
    "IPINFO_TOKEN",
  ]) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
});

describe("loadConfig", () => {
  it("refuses to be read before it is loaded", () => {
    expect(() => freshConfigModule().getConfig()).toThrow(/Config not loaded/);
  });

  it("builds the settings from the environment with safe defaults", async () => {
    Object.assign(process.env, validEnv);
    const mod = freshConfigModule();
    const config = await mod.loadConfig();

    expect(mod.getConfig()).toBe(config);
    expect(config.corsOrigins).toEqual(["http://localhost:3000", "http://localhost:3001"]);
    expect(config.trustProxy).toBe(false);
    expect(config.auth).toMatchObject({
      accessTtlSeconds: 900,
      refreshTtlDays: 7,
      otpTtlMinutes: 10,
      otpResendSeconds: 60,
      otpMaxAttempts: 5,
      otpMaxPerHour: 5,
    });
    expect(config.auth.totpKey).toHaveLength(32);
    expect(config.sms.dryRun).toBe(false);
    expect(config.google.clientIds).toEqual([]);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("loads once and returns the same object afterwards", async () => {
    Object.assign(process.env, validEnv);
    const mod = freshConfigModule();
    expect(await mod.loadConfig()).toBe(await mod.loadConfig());
  });

  it("lists every invalid or missing variable together", async () => {
    Object.assign(process.env, validEnv, { JWT_ACCESS_SECRET: "short", API_BASE_URL: "nope" });
    delete process.env.DATABASE_URL;
    await expect(freshConfigModule().loadConfig()).rejects.toThrow(
      /JWT_ACCESS_SECRET[\s\S]*API_BASE_URL|API_BASE_URL[\s\S]*JWT_ACCESS_SECRET/,
    );
    await expect(freshConfigModule().loadConfig()).rejects.toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown secrets provider instead of silently loading nothing", async () => {
    Object.assign(process.env, validEnv, { SECRETS_PROVIDER: "vault" });
    await expect(freshConfigModule().loadConfig()).rejects.toThrow(/Unknown SECRETS_PROVIDER/);
  });

  it("reads only the process environment with the env provider", async () => {
    Object.assign(process.env, validEnv, { REFRESH_TOKEN_TTL_DAYS: "3", TRUST_PROXY: "2" });
    const config = await freshConfigModule().loadConfig();
    expect(config.auth.refreshTtlDays).toBe(3);
    expect(config.trustProxy).toBe(2);
  });

  it("refuses unsafe settings in production", async () => {
    Object.assign(process.env, validEnv, {
      NODE_ENV: "production",
      SECRETS_PROVIDER: "env",
      SMS_DRY_RUN: "true",
    });
    await expect(freshConfigModule().loadConfig()).rejects.toThrow(
      /Unsafe production configuration/,
    );

    Object.assign(process.env, {
      SMS_DRY_RUN: "false",
      PASSKEY_RP_ID: "swiftgoma.com",
      PASSKEY_ORIGINS: "https://swiftgoma.com",
    });
    const config = await freshConfigModule().loadConfig();
    expect(config.isProd).toBe(true);
  });

  it("parses the social login client ids", async () => {
    Object.assign(process.env, validEnv, {
      GOOGLE_CLIENT_IDS: "a.apps.google.com, b.apps.google.com,",
    });
    const config = await freshConfigModule().loadConfig();
    expect(config.google.clientIds).toEqual(["a.apps.google.com", "b.apps.google.com"]);
  });
});
