import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseTrustProxy } = require("../src/config/env.config");

describe("parseTrustProxy", () => {
  it.each([
    ["false", false],
    ["FALSE", false],
    ["0", false],
    ["", false],
    [undefined, false],
    ["1", 1],
    ["2", 2],
    [" 3 ", 3],
  ])("parses %s", (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });

  it.each(["true", "loopback", "1.5", "-1", "10.0.0.1"])("rejects %s", (input) => {
    expect(parseTrustProxy(input)).toBeNull();
  });
});

describe("productionProblems", () => {
  const { productionProblems } = require("../src/config/env.config");
  const safe = {
    NODE_ENV: "production",
    SMS_DRY_RUN: false,
    PASSKEY_RP_ID: "swiftgoma.com",
    PASSKEY_ORIGINS: ["https://swiftgoma.com"],
  };

  it("accepts a safe production configuration", () => {
    expect(productionProblems(safe)).toEqual([]);
  });

  it("refuses dry-run SMS and localhost passkeys in production", () => {
    const problems = productionProblems({
      ...safe,
      SMS_DRY_RUN: true,
      PASSKEY_RP_ID: "localhost",
      PASSKEY_ORIGINS: ["http://localhost:3000"],
    });
    expect(problems).toHaveLength(3);
  });

  it("ignores development settings", () => {
    expect(productionProblems({ ...safe, NODE_ENV: "development", SMS_DRY_RUN: true })).toEqual([]);
  });
});
