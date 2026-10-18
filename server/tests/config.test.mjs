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
