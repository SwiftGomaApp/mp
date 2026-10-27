import { describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/core/adapters";
import { ConfigError, resolveConfig } from "../src/core/config";
import { createMemoryStore } from "../src/core/memoryStore";

function adapter(overrides: Partial<PlatformAdapter> = {}): PlatformAdapter {
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

const valid = { baseUrl: "https://api.swiftgoma.com", adapter: adapter() };

describe("resolveConfig defaults", () => {
  it("fills in the defaults", () => {
    const config = resolveConfig(valid);
    expect(config.refreshMarginSeconds).toBe(120);
    expect(config.requestTimeoutMs).toBe(15_000);
    expect(config.socials).toEqual({ google: false, apple: false });
    expect(config.now).toBe(Date.now);
    expect(() => config.logger.warn("x")).not.toThrow();
  });

  it("builds the versioned API root without a trailing slash", () => {
    expect(resolveConfig(valid).apiUrl).toBe("https://api.swiftgoma.com/api/v1");
    expect(resolveConfig({ ...valid, baseUrl: "https://api.swiftgoma.com/" }).baseUrl).toBe(
      "https://api.swiftgoma.com",
    );
  });

  it("keeps the values an app provides", () => {
    const now = () => 42;
    const config = resolveConfig({
      ...valid,
      refreshMarginSeconds: 60,
      requestTimeoutMs: 5_000,
      socials: { google: true },
      now,
    });
    expect(config.refreshMarginSeconds).toBe(60);
    expect(config.requestTimeoutMs).toBe(5_000);
    expect(config.socials).toEqual({ google: true, apple: false });
    expect(config.now()).toBe(42);
  });
});

describe("baseUrl", () => {
  it.each([undefined, "", "   ", "not a url", "ftp://api.swiftgoma.com"])(
    "rejects %j",
    (baseUrl) => {
      expect(() => resolveConfig({ ...valid, baseUrl: baseUrl as string })).toThrow(ConfigError);
    },
  );

  it.each([
    "https://api.swiftgoma.com/api/v1",
    "https://api.swiftgoma.com/auth",
    "https://api.swiftgoma.com/?x=1",
    "https://api.swiftgoma.com/#top",
  ])("rejects a path, query or fragment: %s", (baseUrl) => {
    expect(() => resolveConfig({ ...valid, baseUrl })).toThrow(/origin only/);
  });

  it.each([
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://10.0.2.2:4000",
    "http://192.168.1.20:4000",
    "http://172.20.0.5:4000",
    "http://dev-box.local:4000",
  ])("accepts plain http for a local address: %s", (baseUrl) => {
    expect(resolveConfig({ ...valid, baseUrl }).baseUrl).toBe(baseUrl);
  });

  it.each(["http://api.swiftgoma.com", "http://8.8.8.8", "http://172.32.0.1"])(
    "refuses plain http for a public address: %s",
    (baseUrl) => {
      expect(() => resolveConfig({ ...valid, baseUrl })).toThrow(/https/);
    },
  );
});

describe("numbers", () => {
  it.each([
    ["refreshMarginSeconds", 5],
    ["refreshMarginSeconds", 601],
    ["refreshMarginSeconds", 90.5],
    ["refreshMarginSeconds", Number.NaN],
    ["requestTimeoutMs", 500],
    ["requestTimeoutMs", 500_000],
  ])("rejects %s = %s", (name, value) => {
    expect(() => resolveConfig({ ...valid, [name]: value })).toThrow(ConfigError);
  });
});

describe("adapter", () => {
  it("is required", () => {
    expect(() => resolveConfig({ baseUrl: valid.baseUrl } as never)).toThrow(/adapter is required/);
  });

  it("must use cookies on the web and bearer tokens on mobile", () => {
    expect(() =>
      resolveConfig({ ...valid, adapter: adapter({ platform: "WEB", transport: "bearer" }) }),
    ).toThrow(/cookie/);
    expect(() =>
      resolveConfig({ ...valid, adapter: adapter({ platform: "IOS", transport: "cookie" }) }),
    ).toThrow(/bearer/);
    expect(() =>
      resolveConfig({ ...valid, adapter: adapter({ platform: "WEB", transport: "cookie" }) }),
    ).not.toThrow();
  });

  it("must name a known platform", () => {
    expect(() =>
      resolveConfig({ ...valid, adapter: adapter({ platform: "WINDOWS" as never }) }),
    ).toThrow(/platform/);
  });
});

describe("socials", () => {
  it("only accept true or false", () => {
    expect(() => resolveConfig({ ...valid, socials: { google: "yes" as never } })).toThrow(
      /socials.google/,
    );
    expect(() => resolveConfig({ ...valid, socials: { apple: 1 as never } })).toThrow(
      /socials.apple/,
    );
  });

  it("can be switched on one at a time", () => {
    expect(resolveConfig({ ...valid, socials: { apple: true } }).socials).toEqual({
      google: false,
      apple: true,
    });
  });
});
