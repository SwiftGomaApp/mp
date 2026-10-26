import { beforeEach, describe, expect, it } from "vitest";
import { loadWithMocks } from "./helpers/mockModules.mjs";

class FakeRedis {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }
  async incr(key) {
    const value = (Number(this.store.get(key)) || 0) + 1;
    this.store.set(key, value);
    return value;
  }
  async expire(key, seconds) {
    this.ttls.set(key, seconds);
  }
  async ttl(key) {
    return this.ttls.get(key) ?? -1;
  }
  multi() {
    const commands = [];
    const chain = {
      del: (key) => (commands.push(() => this.store.delete(key)), chain),
      hset: (key, ...fields) => (commands.push(() => this.store.set(key, fields)), chain),
      expire: (key, seconds) => (commands.push(() => this.ttls.set(key, seconds)), chain),
      exec: async () => commands.map((run) => run()),
    };
    return chain;
  }
}

let redis;
let settings;

const { issueOtp } = loadWithMocks("core/auth/otp.js", {
  "config/env.config.js": { getConfig: () => ({ auth: settings }) },
  "core/cache/redis.js": { getRedis: () => redis },
});

describe("issueOtp hourly cap", () => {
  beforeEach(() => {
    redis = new FakeRedis();
    settings = {
      otpTtlMinutes: 10,
      otpResendSeconds: 0,
      otpMaxAttempts: 5,
      otpMaxPerHour: 3,
      otpSecret: "s".repeat(32),
    };
  });

  it("allows the configured number of codes per contact, then refuses", async () => {
    for (let i = 0; i < 3; i += 1) {
      await issueOtp({ purpose: "login", target: "+243891234567" });
    }
    await expect(issueOtp({ purpose: "login", target: "+243891234567" })).rejects.toMatchObject({
      status: 429,
      code: "OTP_HOURLY_LIMIT",
    });
  });

  it("counts every purpose against the same contact", async () => {
    await issueOtp({ purpose: "login", target: "a@example.com" });
    await issueOtp({ purpose: "signup", target: "a@example.com" });
    await issueOtp({ purpose: "step-up", target: "A@example.com" });
    await expect(issueOtp({ purpose: "recovery", target: "a@example.com" })).rejects.toMatchObject({
      code: "OTP_HOURLY_LIMIT",
    });
  });

  it("does not count different contacts together", async () => {
    for (let i = 0; i < 3; i += 1) {
      await issueOtp({ purpose: "login", target: `user${i}@example.com` });
    }
    await expect(
      issueOtp({ purpose: "login", target: "other@example.com" }),
    ).resolves.toBeDefined();
  });

  it("can be turned off with 0", async () => {
    settings.otpMaxPerHour = 0;
    for (let i = 0; i < 10; i += 1) {
      await issueOtp({ purpose: "login", target: "+243891234567" });
    }
  });
});
