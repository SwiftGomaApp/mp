import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  randomToken,
  generateOtp,
  sha256,
  hmacSha256,
  safeEqual,
} = require("../src/core/crypto/crypto");

describe("crypto helpers", () => {
  it("generates numeric OTPs with the requested length", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtp(6)).toMatch(/^[0-9]{6}$/);
    }
    expect(generateOtp(4)).toMatch(/^[0-9]{4}$/);
  });

  it("hashes with SHA-256", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("signs with a stable HMAC that depends on the secret", () => {
    expect(hmacSha256("order-1", "secret")).toBe(hmacSha256("order-1", "secret"));
    expect(hmacSha256("order-1", "secret")).not.toBe(hmacSha256("order-1", "other"));
    expect(hmacSha256("order-1", "secret")).not.toBe(hmacSha256("order-2", "secret"));
  });

  it("compares values in a safe way", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("generates unique url-safe tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
