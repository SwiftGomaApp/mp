import { describe, expect, it } from "vitest";
import { CLIENT_ERROR_CODES, ERROR_CODES, isKnownErrorCode } from "../src/index";

const entries = (object: Record<string, string>): [string, string][] => Object.entries(object);

describe("error code catalogue", () => {
  it("names every code exactly like its value, in UPPER_SNAKE_CASE", () => {
    for (const [key, value] of [...entries(ERROR_CODES), ...entries(CLIENT_ERROR_CODES)]) {
      expect(value).toBe(key);
      expect(key).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it("keeps server codes and client codes apart", () => {
    for (const key of Object.keys(CLIENT_ERROR_CODES)) {
      expect(Object.keys(ERROR_CODES)).not.toContain(key);
    }
  });

  it("contains the codes later phases rely on", () => {
    const needed = [
      "VALIDATION_ERROR",
      "TOKEN_EXPIRED",
      "REFRESH_TOKEN_INVALID",
      "REFRESH_TOKEN_MISSING",
      "REFRESH_IN_PROGRESS",
      "TOKEN_REUSED",
      "SESSION_REVOKED",
      "SESSION_EXPIRED",
      "ACCOUNT_SUSPENDED",
      "OTP_INVALID",
      "OTP_COOLDOWN",
      "OTP_HOURLY_LIMIT",
      "TWO_FACTOR_REQUIRED",
      "RECOVERY_WAITING",
      "TOO_MANY_REQUESTS",
    ];
    for (const code of needed) expect(ERROR_CODES).toHaveProperty(code);
  });

  it("recognises known codes and rejects everything else", () => {
    expect(isKnownErrorCode("OTP_INVALID")).toBe(true);
    expect(isKnownErrorCode("NETWORK_ERROR")).toBe(true);
    expect(isKnownErrorCode("SOME_FUTURE_CODE")).toBe(false);
    expect(isKnownErrorCode("toString")).toBe(false);
    expect(isKnownErrorCode(undefined)).toBe(false);
    expect(isKnownErrorCode(42)).toBe(false);
  });
});
