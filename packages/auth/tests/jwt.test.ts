import { describe, expect, it } from "vitest";
import { decodeJwtExpiry } from "../src/core/jwt";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeToken(payload: unknown): string {
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("decodeJwtExpiry", () => {
  it("returns the exp claim in milliseconds", () => {
    expect(decodeJwtExpiry(makeToken({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it("reads the claim even when the payload has non-ASCII text", () => {
    expect(decodeJwtExpiry(makeToken({ name: "Élodie 🚀", exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    );
  });

  it("accepts a payload with base64 padding", () => {
    const payload = `${encode({ exp: 1_800_000_000 })}==`;
    expect(decodeJwtExpiry(`aaa.${payload}.sig`)).toBe(1_800_000_000_000);
  });

  it("returns null when exp is missing or not a positive number", () => {
    expect(decodeJwtExpiry(makeToken({ sub: "1" }))).toBeNull();
    expect(decodeJwtExpiry(makeToken({ exp: "1800000000" }))).toBeNull();
    expect(decodeJwtExpiry(makeToken({ exp: 0 }))).toBeNull();
    expect(decodeJwtExpiry(makeToken({ exp: -5 }))).toBeNull();
  });

  it("returns null for anything that is not a readable token", () => {
    expect(decodeJwtExpiry("")).toBeNull();
    expect(decodeJwtExpiry("not-a-token")).toBeNull();
    expect(decodeJwtExpiry("a.b")).toBeNull();
    expect(decodeJwtExpiry("a.!!!.c")).toBeNull();
    expect(decodeJwtExpiry(`a.${Buffer.from("nope").toString("base64url")}.c`)).toBeNull();
    expect(decodeJwtExpiry(makeToken(["exp"]))).toBeNull();
    expect(decodeJwtExpiry(makeToken(null))).toBeNull();
  });
});
