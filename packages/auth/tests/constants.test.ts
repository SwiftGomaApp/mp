import { describe, expect, it } from "vitest";
import {
  API_PREFIX,
  DEVICE_ID_MAX_LENGTH,
  DEVICE_ID_MIN_LENGTH,
  PLATFORMS,
  ROLES,
  SELF_SIGNUP_ROLES,
} from "../src/index";

describe("constants", () => {
  it("uses the versioned API path without a trailing slash", () => {
    expect(API_PREFIX).toBe("/api/v1");
    expect(API_PREFIX.endsWith("/")).toBe(false);
  });

  it("lists the three platforms the server accepts", () => {
    expect([...PLATFORMS]).toEqual(["ANDROID", "IOS", "WEB"]);
  });

  it("only lets customers sign up by themselves", () => {
    expect([...SELF_SIGNUP_ROLES]).toEqual(["BUYER", "SELLER", "RIDER"]);
    for (const role of SELF_SIGNUP_ROLES) expect(ROLES).toContain(role);
    expect(ROLES).toContain("SUPPORT");
    expect(ROLES).toContain("ADMIN");
  });

  it("keeps the device id bounds the server enforces", () => {
    expect(DEVICE_ID_MIN_LENGTH).toBe(8);
    expect(DEVICE_ID_MAX_LENGTH).toBe(128);
  });
});
